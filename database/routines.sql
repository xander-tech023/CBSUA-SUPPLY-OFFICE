DROP PROCEDURE IF EXISTS review_stock_request
$$

DROP FUNCTION IF EXISTS get_unreserved_stock
$$

CREATE FUNCTION get_unreserved_stock(p_item_id BIGINT UNSIGNED)
RETURNS DECIMAL(12,2)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_on_hand DECIMAL(12,2) DEFAULT 0;
  DECLARE v_reserved DECIMAL(12,2) DEFAULT 0;

  SELECT COALESCE(quantity_on_hand, 0)
  INTO v_on_hand
  FROM inventory_items
  WHERE id = p_item_id AND is_active = 1
  LIMIT 1;

  SELECT COALESCE(SUM(r.quantity - COALESCE(i.issued, 0)), 0)
  INTO v_reserved
  FROM stock_requests r
  LEFT JOIN (
    SELECT request_id, SUM(quantity) AS issued
    FROM stock_issuances
    GROUP BY request_id
  ) i ON i.request_id = r.id
  WHERE r.item_id = p_item_id
    AND r.status = 'Approved';

  RETURN GREATEST(v_on_hand - v_reserved, 0);
END
$$

CREATE PROCEDURE review_stock_request(
  IN p_request_code VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_status VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_reviewer_id BIGINT UNSIGNED
)
BEGIN
  DECLARE v_request_id BIGINT UNSIGNED;
  DECLARE v_old_status VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  DECLARE v_item_id BIGINT UNSIGNED;
  DECLARE v_quantity DECIMAL(12,2);
  DECLARE v_is_admin TINYINT;

  SELECT COUNT(*)
  INTO v_is_admin
  FROM users
  WHERE id = p_reviewer_id
    AND role = 'admin'
    AND is_active = 1;

  IF v_is_admin <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Only the Supply Office head can review requests.';
  END IF;

  IF p_status NOT IN ('Approved', 'Rejected') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Choose a valid request status.';
  END IF;

  SELECT id, status, item_id, quantity
  INTO v_request_id, v_old_status, v_item_id, v_quantity
  FROM stock_requests
  WHERE request_code = p_request_code
  LIMIT 1
  FOR UPDATE;

  IF v_request_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'The stock request could not be found.';
  END IF;

  IF v_old_status <> 'Pending' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'This request is no longer awaiting review.';
  END IF;

  IF p_status = 'Approved'
    AND v_quantity > get_unreserved_stock(v_item_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'There is not enough unreserved stock to approve this request.';
  END IF;

  UPDATE stock_requests
  SET status = p_status,
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW()
  WHERE id = v_request_id;

  INSERT INTO request_status_history
    (request_id, old_status, new_status, changed_by)
  VALUES
    (v_request_id, v_old_status, p_status, p_reviewer_id);
END
$$

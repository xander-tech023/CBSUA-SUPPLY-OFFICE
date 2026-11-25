document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  const minimumDate = today.toISOString().slice(0, 10);
  document.querySelectorAll('input[type="date"][required]').forEach(input => {
    input.min = minimumDate;
    if (input.value && input.value < minimumDate) input.value = minimumDate;
  });

  let messageNumber = 0;
  const validate = field => {
    if (field.disabled || field.readOnly || !field.matches('input, select, textarea')) return;
    field.dataset.validationTouched = 'true';
    const invalid = !field.validity.valid;
    field.setAttribute('aria-invalid', String(invalid));
    field.classList.toggle('border-red-500', invalid);
    field.classList.toggle('border-green-600', !invalid && (field.required || field.value));
    let message = field.nextElementSibling?.matches('[data-validation-for]') ? field.nextElementSibling : null;
    if (invalid) {
      if (!message) {
        if (!field.id) field.id = `validated-field-${messageNumber + 1}`;
        message = document.createElement('p');
        message.className = 'mt-1 text-sm text-red-600';
        message.dataset.validationFor = field.id;
        message.id = `validation-message-${++messageNumber}`;
        message.setAttribute('role', 'status');
        field.insertAdjacentElement('afterend', message);
      }
      message.textContent = field.validationMessage;
      field.setAttribute('aria-describedby', message.id);
    } else {
      message?.remove();
      field.removeAttribute('aria-describedby');
    }
  };
  const validateTouchedField = event => {
    if (event.target.dataset.validationTouched === 'true') validate(event.target);
  };
  document.addEventListener('blur', event => validate(event.target), true);
  document.addEventListener('invalid', event => validate(event.target), true);
  document.addEventListener('input', validateTouchedField);
  document.addEventListener('change', validateTouchedField);
});

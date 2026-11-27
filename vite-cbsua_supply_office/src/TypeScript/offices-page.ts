const offices = [
      ["Accounting Office", "administrative"],
      ["Admission Office", "administrative"],
      ["Alumni Office", "administrative"],
      ["Auxiliary Office", "administrative"],
      ["Budget Office", "administrative"],
      ["Bids and Awards Committee Office", "administrative"],
      ["Business Affairs Unit", "administrative"],
      ["Campus PIO", "administrative"],
      ["Cashier's Office", "administrative"],
      ["College of Engineering", "academic"],
      ["College of Information Technology", "academic"],
      ["Clinic / Infirmary", "support"],
      ["College of Criminology", "academic"],
      ["College of Education", "academic"],
      ["Commission on Audit", "administrative"],
      ["College of Industrial Technology", "academic"],
      ["Curriculum and Instruction Division", "academic"],
      ["Disaster Risk Readiness Management Office", "support"],
      ["Environmental Science and Agroforestry Program", "academic"],
      ["Extension Services Unit", "academic"],
      ["Gender and Development Office", "support"],
      ["General Administration and Support Services", "administrative"],
      ["Guidance and Counseling Unit", "support"],
      ["Human Resource Management Office", "administrative"],
      ["Informations and Communications Technology Office", "support"],
      ["Industry Linkages and Development Office", "administrative"],
      ["Institutional Planning and Development Office", "administrative"],
      ["Library", "academic"],
      ["Motorpool", "support"],
      ["Office of Campus Administrator", "administrative"],
      ["Office of the Student Affairs and Services", "administrative"],
      ["Physical Plant and Development Office", "support"],
      ["Publication Office", "support"],
      ["Quality Assurance Office", "administrative"],
      ["Reading Center", "academic"],
      ["Record's Office", "administrative"],
      ["Registrar's Office", "administrative"],
      ["Research and Development Center", "academic"],
      ["ROTC / NSTP Office", "academic"],
      ["Sentro ng Wika, Kultura at Sining", "academic"],
      ["Supply Office", "administrative"],
      ["UMIS", "support"]
    ].map((office, index) => [
        office[0],
        office[1],
        `OFF-${String(index + 1).padStart(3, "0")}`
      ]);

    const grid = document.getElementById("officeGrid");
    const search = document.getElementById("officeSearch");
    const filter = document.getElementById("officeFilter");
    const results = document.getElementById("officeResults");
    const clear = document.getElementById("clearFilters");
    const activityModal = document.getElementById("officeActivityModal");
    const activityTitle = document.getElementById("officeActivityTitle");
    const activityContent = document.getElementById("officeActivityContent");
    const quotaModal = document.getElementById("officeQuotaModal");
    const quotaForm = document.getElementById("officeQuotaForm");
    const quotaSummary = document.getElementById("officeQuotaSummary");
    const quotaItemSelect = document.getElementById("officeQuotaItem");
    const quotaBudgetInput = document.getElementById("officeQuotaCampusBudget");
    const quotaOfficeLimitInput = document.getElementById("officeQuotaAnnualLimit");
    const officeAliases = {
      "Registrar's Office": ["Registrar"],
      "Clinic / Infirmary": ["Campus Health Services", "Clinic"]
    };
    let recordsPromise;
    let activityOpener;

    function createActivityElement(tag, className = "", text = "") {
      const element = document.createElement(tag);
      element.className = className;
      element.textContent = text;
      return element;
    }

    function renderOfficeQuotaSummaries() {
      const currentYear = new Date().getFullYear();
      const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
      const quotas = window.IMS?.getLocalRecords("officeQuotas") || [];
      grid.querySelectorAll("[data-office-quota-summary]").forEach(container => {
        const officeCard = container.closest("[data-office-code]");
        const officeId = officeCard?.dataset.officeCode;
        const officeQuotas = quotas.filter(quota => quota.officeId === officeId
          && Number(quota.year) === currentYear);
        container.replaceChildren();
        if (!officeQuotas.length) {
          container.append(createActivityElement("p", "text-xs text-cbsua-muted",
            "No item allocations assigned for this year."));
          return;
        }
        officeQuotas.slice(0, 3).forEach(quota => {
          const itemLine = createActivityElement("div", "flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs");
          itemLine.append(
            createActivityElement("span", "font-medium", quota.itemName),
            createActivityElement("span", "text-cbsua-muted",
              `Q${currentQuarter}: ${quota.currentQuarterUsed}/${quota.currentQuarterLimit} ${quota.unit} · Annual ${quota.annualUsed}/${quota.annualLimit} ${quota.unit}`)
          );
          container.append(itemLine);
        });
        if (officeQuotas.length > 3) {
          container.append(createActivityElement("p", "text-xs text-cbsua-muted",
            `+ ${officeQuotas.length - 3} more item allocation${officeQuotas.length - 3 === 1 ? "" : "s"}`));
        }
      });
    }

    function closeOfficeActivity() {
      activityModal.classList.add("hidden");
      activityModal.classList.remove("flex");
      activityOpener?.focus();
    }

    async function showOfficeActivity(office, opener) {
      activityOpener = opener;
      activityTitle.textContent = `${office} — Recent activity`;
      activityContent.replaceChildren(createActivityElement("p", "text-cbsua-muted", "Loading office activity…"));
      activityModal.classList.remove("hidden");
      activityModal.classList.add("flex");
      activityModal.querySelector("[data-close-office-activity]").focus();

      try {
        if (!recordsPromise) recordsPromise = window.IMS.initializeRecords();
        await recordsPromise;

        const items = window.IMS.getLocalRecords("items");
        const requests = window.IMS.getLocalRecords("requests")
          .filter(request => request.office === office || officeAliases[office]?.includes(request.office))
          .map(request => ({
            id: request.id,
            date: request.date || request.createdAt,
            type: "Requested",
            item: items.find(item => item.id === request.itemId),
            itemFallback: request.item || request.itemId,
            quantity: request.quantity,
            status: request.status || "Pending",
            recipient: request.recipient
          }));
        const issuances = window.IMS.getLocalRecords("issuances")
          .filter(issuance => issuance.office === office || officeAliases[office]?.includes(issuance.office))
          .map(issuance => ({
            id: issuance.id,
            date: issuance.date || issuance.createdAt,
            type: "Issued",
            item: items.find(item => item.id === issuance.itemId),
            itemFallback: issuance.itemName || issuance.itemId,
            quantity: [issuance.quantity, issuance.unit].filter(Boolean).join(" "),
            status: "Issued",
            recipient: issuance.recipient
          }));
        const activity = [...requests, ...issuances]
          .sort((left, right) => (Date.parse(right.date) || 0) - (Date.parse(left.date) || 0));

        activityContent.replaceChildren();
        if (!activity.length) {
          activityContent.append(createActivityElement("p", "py-6 text-center text-cbsua-muted",
            "No requests or stock transactions are recorded for this office yet."));
          return;
        }

        const tableWrapper = createActivityElement("div", "overflow-x-auto");
        const table = createActivityElement("table", "w-full min-w-[700px] text-left");
        const header = document.createElement("thead");
        const headerRow = createActivityElement("tr", "border-b border-cbsua-border text-cbsua-muted");
        ["Date", "Activity", "Requested stock", "Quantity", "Status", "Employee"].forEach(label => {
          headerRow.append(createActivityElement("th", "px-3 py-2 font-medium", label));
        });
        header.append(headerRow);
        const body = document.createElement("tbody");
        activity.slice(0, 10).forEach(entry => {
          const row = createActivityElement("tr", "border-b border-cbsua-border/50");
          const date = entry.date && !Number.isNaN(Date.parse(entry.date))
            ? new Date(entry.date).toLocaleDateString()
            : "—";
          const stock = entry.item
            ? `${entry.item.id} — ${entry.item.name}`
            : entry.itemFallback || "—";
          [date, `${entry.type} · ${entry.id}`, stock, entry.quantity || "—", entry.status, entry.recipient || "—"]
            .forEach(value => row.append(createActivityElement("td", "px-3 py-3 align-top", value)));
          body.append(row);
        });
        table.append(header, body);
        tableWrapper.append(table);
        activityContent.append(
          createActivityElement("p", "mb-3 text-cbsua-muted", `Showing the ${Math.min(activity.length, 10)} most recent request and issuance records.`),
          tableWrapper
        );
      } catch (error) {
        console.error("Office activity could not be loaded.", error);
        activityContent.replaceChildren(createActivityElement("p", "py-6 text-center text-red-700",
          "Office activity could not be loaded. Please close this window and try again."));
      }
    }

    function renderOffices() {
      const query = search.value.trim().toLowerCase();
      const category = filter.value;
      const visible = offices.filter(([name, type]) =>
        (category === "all" || type === category) &&
        name.toLowerCase().includes(query)
      );

      grid.innerHTML = visible.map(([name, type, officeId]) => {
        const initials = name.split(/[\s/]+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").replace(/[^A-Z]/gi, "").toUpperCase();
        const label = type.charAt(0).toUpperCase() + type.slice(1);
        const allocationAction = window.IMS?.currentUser?.role === "admin"
          ? `<button type="button" class="office-quota-manage text-cbsua-primary font-medium hover:underline" data-office="${name}" data-office-id="${officeId}">Set item request limits</button>`
          : "";
        return `
          <article class="stat-card hover:border-cbsua-primary/40 transition-colors" data-office-code="${officeId}">
            <div class="flex items-start gap-3">
              <div class="shrink-0 w-11 h-11 rounded-lg bg-cbsua-light text-cbsua-primary flex items-center justify-center font-bold">${initials || "O"}</div>
              <div class="min-w-0 flex-1">
                <h3 class="font-semibold leading-snug">
                  <button type="button" class="office-details text-left hover:text-cbsua-primary" data-office="${name}" aria-label="View recent activity for ${name}">${name}</button>
                </h3>
                <p class="mt-1 text-xs font-medium text-cbsua-primary">${officeId}</p>
                <span class="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-gray-100 text-cbsua-muted">${label}</span>
              </div>
              <span class="text-xs text-cbsua-muted whitespace-nowrap">Active</span>
            </div>
            <div data-office-quota-summary class="mt-4 space-y-2 border-t border-cbsua-border pt-3"></div>
            <div class="mt-4 pt-3 border-t border-cbsua-border flex items-center justify-between gap-3 text-sm">
              <button type="button" class="office-details text-cbsua-primary font-medium hover:underline" data-office="${name}">Recent activity →</button>
            </div>
            ${allocationAction ? `<div class="mt-3 text-right text-sm">${allocationAction}</div>` : ""}
          </article>`;
      }).join("");
      renderOfficeQuotaSummaries();

      results.textContent = `Showing ${visible.length} ${visible.length === 1 ? "office" : "offices"}`;
      clear.classList.toggle("hidden", !query && category === "all");
    }

    function currentOfficeQuota() {
      const currentYear = new Date().getFullYear();
      return (window.IMS?.getLocalRecords("officeQuotas") || []).find(quota =>
        quota.officeId === document.getElementById("officeQuotaOfficeId").value
        && quota.itemId === quotaItemSelect.value
        && Number(quota.year) === currentYear);
    }

    function updateQuotaFormSummary() {
      if (!quotaSummary) return;
      const itemId = quotaItemSelect.value;
      const currentYear = new Date().getFullYear();
      const items = window.IMS?.getLocalRecords("items") || [];
      const budgets = window.IMS?.getLocalRecords("itemAnnualBudgets") || [];
      const quotas = window.IMS?.getLocalRecords("officeQuotas") || [];
      const item = items.find(entry => entry.id === itemId);
      if (!item) {
        quotaSummary.textContent = "Choose an item to view its allocation.";
        return;
      }
      const currentBudget = budgets.find(budget => budget.itemId === itemId
        && Number(budget.year) === currentYear);
      const currentQuota = currentOfficeQuota();
      const campusBudget = Number(quotaBudgetInput.value);
      const officeLimit = Number(quotaOfficeLimitInput.value);
      const totalAllocated = currentBudget?.allocated
        ?? quotas.filter(quota => quota.itemId === itemId && Number(quota.year) === currentYear)
          .reduce((total, quota) => total + Number(quota.annualLimit), 0);
      const allocatedElsewhere = Math.max(0, totalAllocated - Number(currentQuota?.annualLimit || 0));
      const remainingCampusBudget = Math.max(0, campusBudget - allocatedElsewhere - officeLimit);
      const quarterLimits = [1, 2, 3, 4].map(quarter =>
        Math.floor(officeLimit / 4) + (quarter <= officeLimit % 4 ? 1 : 0));
      quotaSummary.textContent = `Already allocated to other offices: ${allocatedElsewhere} ${item.unit}. `
        + `After saving, ${allocatedElsewhere + officeLimit} of ${campusBudget || 0} ${item.unit} will be assigned; `
        + `${remainingCampusBudget} ${item.unit} will remain. Quarterly limits: `
        + quarterLimits.map((limit, index) => `Q${index + 1} ${limit}`).join(" · ") + ".";
    }

    function openOfficeQuota(officeName, officeId) {
      if (window.IMS?.currentUser?.role !== "admin") return;
      const items = window.IMS.getLocalRecords("items");
      const selectedItemId = quotaItemSelect.value;
      quotaItemSelect.replaceChildren(...items.map(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${item.name} (${item.id}) · ${item.unit}`;
        return option;
      }));
      if (items.some(item => item.id === selectedItemId)) quotaItemSelect.value = selectedItemId;
      document.getElementById("officeQuotaOfficeId").value = officeId;
      document.getElementById("officeQuotaOffice").textContent = `${officeName} · ${officeId}`;
      const budget = window.IMS.getLocalRecords("itemAnnualBudgets")
        .find(entry => entry.itemId === quotaItemSelect.value);
      const quota = (window.IMS.getLocalRecords("officeQuotas") || [])
        .find(entry => entry.officeId === officeId && entry.itemId === quotaItemSelect.value);
      quotaBudgetInput.value = budget?.annualBudget ?? quota?.campusAnnualBudget ?? "";
      quotaOfficeLimitInput.value = quota?.annualLimit ?? "";
      quotaModal.classList.remove("hidden");
      quotaModal.classList.add("flex");
      updateQuotaFormSummary();
      quotaItemSelect.focus();
    }

    function closeOfficeQuota() {
      quotaModal.classList.add("hidden");
      quotaModal.classList.remove("flex");
    }

    function updateOfficeQuotaItem() {
      const year = new Date().getFullYear();
      const itemId = quotaItemSelect.value;
      const officeId = document.getElementById("officeQuotaOfficeId").value;
      const budget = (window.IMS.getLocalRecords("itemAnnualBudgets") || [])
        .find(entry => entry.itemId === itemId && Number(entry.year) === year);
      const quota = (window.IMS.getLocalRecords("officeQuotas") || [])
        .find(entry => entry.officeId === officeId && entry.itemId === itemId
          && Number(entry.year) === year);
      quotaBudgetInput.value = budget?.annualBudget ?? quota?.campusAnnualBudget ?? "";
      quotaOfficeLimitInput.value = quota?.annualLimit ?? "";
      updateQuotaFormSummary();
    }

    search.addEventListener("input", renderOffices);
    filter.addEventListener("change", renderOffices);
    clear.addEventListener("click", () => {
      search.value = "";
      filter.value = "all";
      renderOffices();
    });

    document.getElementById("newOfficeRequest").addEventListener("click", () => {
      window.location.href = "stock_request.html?newRequest=1";
    });
    grid.addEventListener("click", event => {
      const quotaButton = event.target.closest(".office-quota-manage");
      if (quotaButton) {
        openOfficeQuota(quotaButton.dataset.office, quotaButton.dataset.officeId);
        return;
      }
      const detailsButton = event.target.closest(".office-details");
      if (detailsButton) showOfficeActivity(detailsButton.dataset.office, detailsButton);
    });

    quotaItemSelect.addEventListener("change", updateOfficeQuotaItem);
    quotaBudgetInput.addEventListener("input", updateQuotaFormSummary);
    quotaOfficeLimitInput.addEventListener("input", updateQuotaFormSummary);
    quotaModal.querySelectorAll("[data-close-office-quota]").forEach(button => {
      button.addEventListener("click", closeOfficeQuota);
    });
    quotaForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (window.IMS?.currentUser?.role !== "admin") return;
      if (!quotaForm.reportValidity()) return;
      const itemId = quotaItemSelect.value;
      const officeId = document.getElementById("officeQuotaOfficeId").value;
      const annualBudget = Number(quotaBudgetInput.value);
      const officeAnnualLimit = Number(quotaOfficeLimitInput.value);
      if (!Number.isSafeInteger(annualBudget) || annualBudget < 0
        || !Number.isSafeInteger(officeAnnualLimit) || officeAnnualLimit < 0) {
        return window.IMS.showToast("Enter whole-number annual budgets and allocations.");
      }
      const budget = (window.IMS.getLocalRecords("itemAnnualBudgets") || [])
        .find(entry => entry.itemId === itemId && Number(entry.year) === new Date().getFullYear());
      const quota = currentOfficeQuota();
      const allocated = budget?.allocated
        ?? (window.IMS.getLocalRecords("officeQuotas") || [])
          .filter(entry => entry.itemId === itemId && Number(entry.year) === new Date().getFullYear())
          .reduce((total, entry) => total + Number(entry.annualLimit), 0);
      const allocatedElsewhere = Math.max(0, allocated - Number(quota?.annualLimit || 0));
      if (allocatedElsewhere + officeAnnualLimit > annualBudget) {
        return window.IMS.showToast(
          `Office allocations would total ${allocatedElsewhere + officeAnnualLimit}, above the campus budget of ${annualBudget}.`
        );
      }
      const submitButton = quotaForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      const saved = await window.IMS.setOfficeItemQuota({
        officeId,
        itemId,
        year: new Date().getFullYear(),
        annualBudget,
        officeAnnualLimit
      });
      submitButton.disabled = false;
      if (!saved) return;
      closeOfficeQuota();
      window.IMS.showToast("Office item allocation saved.");
    });
    window.addEventListener("ims:records-updated", () => {
      renderOffices();
      updateQuotaFormSummary();
    });

    activityModal.querySelector("[data-close-office-activity]").addEventListener("click", closeOfficeActivity);
    activityModal.addEventListener("click", event => {
      if (event.target === activityModal) closeOfficeActivity();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !activityModal.classList.contains("hidden")) closeOfficeActivity();
    });

    renderOffices();

export {};

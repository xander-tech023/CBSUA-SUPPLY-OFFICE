window.IMS.pageFeatures.push(() => {
  const button = document.querySelector('[data-share-asset-scanner]');
  const link = document.querySelector('[data-asset-scanner-link]');
  const { showToast } = window.IMS;
  if (!button || !link) return;

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const response = await fetch(`/api/scanner-link?appUrl=${encodeURIComponent(location.origin)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Scanner API returned ${response.status}.`);

      link.href = result.url;
      link.textContent = result.url;
      link.hidden = false;
      if (navigator.share) {
        try {
          await navigator.share({ title: 'CBSUA asset scanner', url: result.url });
          showToast('Scanner link shared.');
        } catch (error) {
          if (error.name !== 'AbortError') throw error;
          showToast('Sharing canceled. The scanner link is still available here.');
        }
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.url);
        showToast('Scanner link copied. You can also open the link shown here.');
      } else {
        showToast('Scanner link is ready. Open or copy the link shown here.');
      }
    } catch (error) {
      showToast(`Could not create or share the scanner link: ${error.message}`);
      console.error('Scanner link request failed.', error);
    } finally {
      button.disabled = false;
    }
  });
});

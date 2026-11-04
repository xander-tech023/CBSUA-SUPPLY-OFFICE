(() => {
  const react = document.createElement('script');
  react.src = 'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js';
  react.onload = () => {
    const reactDom = document.createElement('script');
    reactDom.src = 'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js';
    reactDom.onerror = () => console.error('ReactDOM could not be loaded; notifications are using the built-in fallback.');
    document.head.append(reactDom);
  };
  react.onerror = () => console.error('React could not be loaded; notifications are using the built-in fallback.');
  document.head.append(react);
})();

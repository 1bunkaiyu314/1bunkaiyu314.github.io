document.querySelectorAll('pre.vba').forEach(block => {
  const code = document.createElement('code');
  code.className = 'language-vbnet';
  code.textContent = block.textContent.trim();
  block.innerHTML = '';
  block.appendChild(code);
  hljs.highlightElement(code);
});

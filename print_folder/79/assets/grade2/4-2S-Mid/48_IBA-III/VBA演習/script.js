document.querySelectorAll('pre.vba').forEach(block => {
  const code = document.createElement('code');
  code.className = 'language-vbnet';
  code.textContent = block.textContent.trim();
  block.innerHTML = '';
  block.appendChild(code);
  hljs.highlightElement(code);
});

document.addEventListener("DOMContentLoaded", function() {
  const acc = document.querySelectorAll(".accordion");
  acc.forEach(button => {
    button.addEventListener("click", function() {
      this.classList.toggle("active");
      const panel = this.nextElementSibling;
      if (panel.style.display === "block") {
        panel.style.display = "none";
      } else {
        panel.style.display = "block";
      }
      if (panel.classList.contains("open")) {
        const mermaidBlocks = panel.querySelectorAll(".mermaid");
        if (mermaidBlocks.length > 0) {
          mermaid.init(undefined, mermaidBlocks);
        }
      }
    });
  });
});
// コードブロックをハイライト
document.querySelectorAll('pre.vba').forEach(block => {
  const code = document.createElement('code');
  code.className = 'language-vbnet';
  code.textContent = block.textContent.trim();
  block.innerHTML = '';
  block.appendChild(code);
  hljs.highlightElement(code);
});

// 年号更新
document.getElementById('year').textContent = new Date().getFullYear();

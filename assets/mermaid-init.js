document.addEventListener('DOMContentLoaded', async () => {
  const blocks = document.querySelectorAll('pre > code.language-mermaid');
  if (!blocks.length || !window.mermaid) return;
  for (const code of blocks) {
    const pre = code.parentElement;
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid';
    wrapper.textContent = code.textContent;
    pre.replaceWith(wrapper);
  }
  try {
    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default', flowchart: { useMaxWidth: true, htmlLabels: false } });
    await window.mermaid.run({ querySelector: '.mermaid' });
  } catch (error) {
    console.error('Mermaid rendering failed', error);
  }
});

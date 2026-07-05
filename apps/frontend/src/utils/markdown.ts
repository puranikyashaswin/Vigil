/**
 * Lightweight, safe parser to compile basic markdown tags (bold, lists, links, headers)
 * into semantic, styled HTML tags for consistent UI rendering.
 */
export function renderMarkdown(text: string): string {
  if (!text) return "";
  
  // Escape HTML elements to prevent XSS (only allowing tags we generate)
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
    
  // 1. Compile Markdown headers
  html = html.replace(/^###\s+(.+)$/gm, "<h3 class='text-sm font-semibold mt-3 mb-1 text-zinc-900 dark:text-zinc-100'>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2 class='text-md font-bold mt-4 mb-2 text-zinc-900 dark:text-zinc-100'>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1 class='text-lg font-bold mt-5 mb-2 text-zinc-900 dark:text-zinc-100'>$1</h1>");
  
  // 2. Bold text matching **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-zinc-950 dark:text-white'>$1</strong>");
  
  // 3. Links matching [label](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2' target='_blank' rel='noopener noreferrer' class='text-[#788c5d] hover:underline font-semibold'>$1</a>");
  
  // 4. Multi-line list compiler
  const lines = html.split("\n");
  let inList = false;
  const processedLines = [];
  
  for (let line of lines) {
    const listMatch = line.match(/^(\*|-)\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        processedLines.push("<ul class='list-disc pl-5 my-2 space-y-1.5 text-zinc-700 dark:text-zinc-300'>");
        inList = true;
      }
      processedLines.push(`<li>${listMatch[2]}</li>`);
    } else {
      if (inList) {
        processedLines.push("</ul>");
        inList = false;
      }
      processedLines.push(line);
    }
  }
  if (inList) {
    processedLines.push("</ul>");
  }
  
  html = processedLines.join("\n");
  
  // 5. Structure text block paragraphs
  html = html.split(/\n{2,}/).map(paragraph => {
    const trimmed = paragraph.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<li")) {
      return trimmed;
    }
    return `<p class="leading-relaxed mb-3 text-zinc-800 dark:text-zinc-200">${trimmed.replace(/\n/g, "<br />")}</p>`;
  }).filter(Boolean).join("\n");
  
  return html;
}

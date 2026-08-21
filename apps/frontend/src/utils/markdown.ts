/**
 * Full markdown renderer for Vigil AI responses.
 * Handles: headers, bold, italic, tables, blockquotes, lists, code, links, hr.
 */
export function renderMarkdown(text: string): string {
  if (!text) return "";

  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Process blocks line by line
  const lines = html.split("\n");
  const output: string[] = [];
  let inTable = false;
  let inList = false;
  let inOrderedList = false;
  let inBlockquote = false;
  let listType: "ul" | "ol" = "ul";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // --- Horizontal rule ---
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      if (inList) { output.push(listType === "ol" ? "</ol>" : "</ul>"); inList = false; inOrderedList = false; }
      if (inBlockquote) { output.push("</blockquote>"); inBlockquote = false; }
      if (inTable) { output.push("</tbody></table></div>"); inTable = false; }
      output.push("<hr class='my-4 border-zinc-200 dark:border-zinc-700' />");
      continue;
    }

    // --- Table detection ---
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      // Check if next line is separator
      const nextLine = lines[i + 1]?.trim() || "";
      const isSeparator = /^\|[\s:|-]+\|$/.test(line.trim());

      if (isSeparator) {
        continue; // skip separator rows
      }

      if (!inTable) {
        if (inList) { output.push(listType === "ol" ? "</ol>" : "</ul>"); inList = false; inOrderedList = false; }
        if (inBlockquote) { output.push("</blockquote>"); inBlockquote = false; }

        // Check if next line is a separator (this line is header)
        const isHeader = /^\|[\s:|-]+\|$/.test(nextLine);
        if (isHeader) {
          output.push("<div class='overflow-x-auto my-3'><table class='w-full text-xs border-collapse'>");
          const cells = line.split("|").filter(c => c.trim() !== "");
          output.push("<thead><tr class='border-b border-zinc-300 dark:border-zinc-600'>");
          cells.forEach(cell => {
            output.push(`<th class='px-3 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800'>${inlineFormat(cell.trim())}</th>`);
          });
          output.push("</tr></thead><tbody>");
          inTable = true;
          i++; // skip separator line
          continue;
        } else {
          // Table without explicit header
          output.push("<div class='overflow-x-auto my-3'><table class='w-full text-xs border-collapse'><tbody>");
          inTable = true;
        }
      }

      // Table row
      const cells = line.split("|").filter(c => c.trim() !== "");
      output.push("<tr class='border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'>");
      cells.forEach(cell => {
        output.push(`<td class='px-3 py-2 text-zinc-700 dark:text-zinc-300'>${inlineFormat(cell.trim())}</td>`);
      });
      output.push("</tr>");
      continue;
    } else if (inTable) {
      output.push("</tbody></table></div>");
      inTable = false;
    }

    // --- Blockquote ---
    if (line.trim().startsWith("&gt;")) {
      if (inList) { output.push(listType === "ol" ? "</ol>" : "</ul>"); inList = false; inOrderedList = false; }
      if (!inBlockquote) {
        output.push("<blockquote class='border-l-3 border-[#d97757] pl-4 my-3 py-1 bg-[#d97757]/5 dark:bg-[#d97757]/10 rounded-r-lg'>");
        inBlockquote = true;
      }
      const content = line.trim().replace(/^&gt;\s?/, "");
      output.push(`<p class='text-sm text-zinc-700 dark:text-zinc-300 italic leading-relaxed my-1'>${inlineFormat(content)}</p>`);
      continue;
    } else if (inBlockquote) {
      output.push("</blockquote>");
      inBlockquote = false;
    }

    // --- Headers ---
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      if (inList) { output.push(listType === "ol" ? "</ol>" : "</ul>"); inList = false; inOrderedList = false; }
      output.push(`<h3 class='text-sm font-bold mt-4 mb-1.5 text-zinc-900 dark:text-zinc-100'>${inlineFormat(h3Match[1])}</h3>`);
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      if (inList) { output.push(listType === "ol" ? "</ol>" : "</ul>"); inList = false; inOrderedList = false; }
      output.push(`<h2 class='text-base font-bold mt-5 mb-2 text-zinc-900 dark:text-zinc-100'>${inlineFormat(h2Match[1])}</h2>`);
      continue;
    }
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      if (inList) { output.push(listType === "ol" ? "</ol>" : "</ul>"); inList = false; inOrderedList = false; }
      output.push(`<h1 class='text-lg font-bold mt-5 mb-2 text-zinc-900 dark:text-zinc-100'>${inlineFormat(h1Match[1])}</h1>`);
      continue;
    }

    // --- Ordered list ---
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      if (inList && !inOrderedList) { output.push("</ul>"); inList = false; }
      if (!inOrderedList) {
        output.push("<ol class='list-decimal pl-5 my-2 space-y-1 text-zinc-700 dark:text-zinc-300 text-sm'>");
        inOrderedList = true;
        inList = true;
        listType = "ol";
      }
      output.push(`<li>${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    // --- Unordered list ---
    const ulMatch = line.match(/^[\*\-]\s+(.+)$/);
    if (ulMatch) {
      if (inList && inOrderedList) { output.push("</ol>"); inList = false; inOrderedList = false; }
      if (!inList) {
        output.push("<ul class='list-disc pl-5 my-2 space-y-1 text-zinc-700 dark:text-zinc-300 text-sm'>");
        inList = true;
        listType = "ul";
      }
      output.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    // Close list if no longer in it
    if (inList && line.trim() === "") {
      output.push(listType === "ol" ? "</ol>" : "</ul>");
      inList = false;
      inOrderedList = false;
      continue;
    }

    // --- Regular paragraph or empty line ---
    if (line.trim() === "") {
      output.push("");
    } else {
      if (inList) { output.push(listType === "ol" ? "</ol>" : "</ul>"); inList = false; inOrderedList = false; }
      output.push(`<p class='leading-relaxed mb-2 text-zinc-800 dark:text-zinc-200 text-sm'>${inlineFormat(line)}</p>`);
    }
  }

  // Close any open blocks
  if (inList) output.push(listType === "ol" ? "</ol>" : "</ul>");
  if (inBlockquote) output.push("</blockquote>");
  if (inTable) output.push("</tbody></table></div>");

  return output.join("\n");
}

function inlineFormat(text: string): string {
  // Bold **text**
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-zinc-900 dark:text-zinc-50'>$1</strong>");
  // Italic *text*
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // Inline code `text`
  text = text.replace(/`([^`]+)`/g, "<code class='px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[11px] font-mono text-[#d97757]'>$1</code>");
  // Links [label](url)
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2' class='text-[#6a9bcc] hover:underline font-medium'>$1</a>");
  // Emoji-safe (already rendered)
  return text;
}

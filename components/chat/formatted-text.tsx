"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormattedTextProps {
  text: string;
  isStreaming?: boolean;
  className?: string;
}

interface InlineToken {
  type: "text" | "bold" | "italic" | "strike" | "code" | "link";
  content?: string;
  label?: string;
  url?: string;
}

// Tokenizes inline formatting: bold, italic, strikethrough, inline code, and URLs
function parseInline(text: string): InlineToken[] {
  // Matches:
  // 1. `code`
  // 2. [label](url)
  // 3. raw URL https?://...
  // 4. **bold**
  // 5. ~~strike~~ or ~strike~
  // 6. _italic_ or *italic*
  const pattern =
    /(`[^`]+`)|(\[[^\]]+\]\(https?:\/\/[^\s)]+\))|(https?:\/\/[^\s<]+)|(\*\*[^*]+\*\*)|(~~[^~]+~~|~[^~]+~)|(_[^_]+_|\*[^*]+\*)/g;

  let lastIndex = 0;
  const tokens: InlineToken[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    const full = match[0];
    if (full.startsWith("`") && full.endsWith("`")) {
      tokens.push({ type: "code", content: full.slice(1, -1) });
    } else if (full.startsWith("[") && full.includes("](")) {
      const splitIdx = full.indexOf("](");
      const label = full.slice(1, splitIdx);
      const url = full.slice(splitIdx + 2, -1);
      tokens.push({ type: "link", label, url });
    } else if (full.startsWith("http://") || full.startsWith("https://")) {
      // Trim trailing punctuation like . , )
      const cleanUrl = full.replace(/[.,)]+$/, "");
      tokens.push({ type: "link", label: cleanUrl, url: cleanUrl });
      // If we trimmed anything, advance lastIndex carefully
      if (cleanUrl.length < full.length) {
        lastIndex = match.index + cleanUrl.length;
        pattern.lastIndex = lastIndex;
        continue;
      }
    } else if (full.startsWith("**") && full.endsWith("**")) {
      tokens.push({ type: "bold", content: full.slice(2, -2) });
    } else if (full.startsWith("~~") && full.endsWith("~~")) {
      tokens.push({ type: "strike", content: full.slice(2, -2) });
    } else if (full.startsWith("~") && full.endsWith("~")) {
      tokens.push({ type: "strike", content: full.slice(1, -1) });
    } else if (full.startsWith("_") && full.endsWith("_")) {
      tokens.push({ type: "italic", content: full.slice(1, -1) });
    } else if (full.startsWith("*") && full.endsWith("*")) {
      tokens.push({ type: "italic", content: full.slice(1, -1) });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", content: text.slice(lastIndex) });
  }

  return tokens;
}

function RenderInline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.type) {
          case "bold":
            return (
              <strong key={index} className="font-semibold text-foreground">
                {token.content}
              </strong>
            );
          case "italic":
            return (
              <em key={index} className="italic text-foreground/95">
                {token.content}
              </em>
            );
          case "strike":
            return (
              <s key={index} className="line-through opacity-75">
                {token.content}
              </s>
            );
          case "code":
            return (
              <code
                key={index}
                className="rounded bg-black/[0.07] px-1 py-0.5 font-mono text-[0.88em] dark:bg-white/10"
              >
                {token.content}
              </code>
            );
          case "link":
            return (
              <a
                key={index}
                href={token.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="break-all underline underline-offset-2 hover:opacity-80"
              >
                {token.label}
              </a>
            );
          case "text":
          default:
            return <React.Fragment key={index}>{token.content}</React.Fragment>;
        }
      })}
    </>
  );
}

function CodeBlockItem({ lang, code }: { lang?: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy error
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border bg-background text-foreground">
      <div className="flex items-center justify-between border-b bg-muted px-3 py-1.5 text-xs text-muted-foreground">
        <span>{lang || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface Block {
  type:
    | "h1"
    | "h2"
    | "h3"
    | "blockquote"
    | "bullet"
    | "numbered"
    | "codeblock"
    | "paragraph"
    | "empty";
  content?: string;
  lang?: string;
  num?: string;
}

export function FormattedText({ text, isStreaming, className }: FormattedTextProps) {
  if (!text) {
    return isStreaming ? (
      <span
        className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-current opacity-60"
        aria-hidden="true"
      />
    ) : null;
  }

  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      if (inCodeBlock) {
        blocks.push({
          type: "codeblock",
          lang: codeBlockLang,
          content: codeBlockLines.join("\n"),
        });
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = "";
      } else {
        inCodeBlock = true;
        codeBlockLang = fenceMatch[1] || "";
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Heading 3: ### ...
    const h3Match = line.match(/^###\s+(.*)$/);
    if (h3Match) {
      blocks.push({ type: "h3", content: h3Match[1] });
      continue;
    }

    // Heading 2: ## ...
    const h2Match = line.match(/^##\s+(.*)$/);
    if (h2Match) {
      blocks.push({ type: "h2", content: h2Match[1] });
      continue;
    }

    // Heading 1: # ...
    const h1Match = line.match(/^#\s+(.*)$/);
    if (h1Match) {
      blocks.push({ type: "h1", content: h1Match[1] });
      continue;
    }

    // Blockquote: > ...
    const quoteMatch = line.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      blocks.push({ type: "blockquote", content: quoteMatch[1] });
      continue;
    }

    // Bullet list: - ... or * ...
    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      blocks.push({ type: "bullet", content: listMatch[1] });
      continue;
    }

    // Numbered list: 1. ...
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      blocks.push({ type: "numbered", num: numMatch[1], content: numMatch[2] });
      continue;
    }

    // Blank line
    if (!line.trim()) {
      blocks.push({ type: "empty" });
      continue;
    }

    // Paragraph line
    blocks.push({ type: "paragraph", content: line });
  }

  // Handle in-flight open code block during streaming
  if (inCodeBlock && codeBlockLines.length > 0) {
    blocks.push({
      type: "codeblock",
      lang: codeBlockLang,
      content: codeBlockLines.join("\n"),
    });
  }

  const caret = isStreaming ? (
    <span
      className="ml-1 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-current opacity-60"
      aria-hidden="true"
    />
  ) : null;

  return (
    <div
      className={cn(
        "space-y-1 text-left leading-relaxed break-words whitespace-normal",
        className,
      )}
    >
      {blocks.map((block, idx) => {
        const isLast = idx === blocks.length - 1;

        switch (block.type) {
          case "h1":
            return (
              <h1
                key={idx}
                className="text-base sm:text-lg font-bold tracking-tight text-foreground mt-2 mb-1"
              >
                <RenderInline tokens={parseInline(block.content || "")} />
                {isLast && caret}
              </h1>
            );
          case "h2":
            return (
              <h2
                key={idx}
                className="text-sm sm:text-base font-bold tracking-tight text-foreground mt-1.5 mb-0.5"
              >
                <RenderInline tokens={parseInline(block.content || "")} />
                {isLast && caret}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={idx}
                className="mb-0.5 mt-1 font-semibold"
              >
                <RenderInline tokens={parseInline(block.content || "")} />
                {isLast && caret}
              </h3>
            );
          case "blockquote":
            return (
              <blockquote
                key={idx}
                className="my-1 border-l-2 border-current pl-2.5 opacity-80"
              >
                <RenderInline tokens={parseInline(block.content || "")} />
                {isLast && caret}
              </blockquote>
            );
          case "bullet":
            return (
              <div key={idx} className="my-0.5 flex items-start gap-2">
                <span className="select-none opacity-60" aria-hidden="true">
                  •
                </span>
                <div className="flex-1 min-w-0">
                  <RenderInline tokens={parseInline(block.content || "")} />
                  {isLast && caret}
                </div>
              </div>
            );
          case "numbered":
            return (
              <div key={idx} className="my-0.5 flex items-start gap-2">
                <span className="select-none tabular-nums opacity-60">
                  {block.num}.
                </span>
                <div className="flex-1 min-w-0">
                  <RenderInline tokens={parseInline(block.content || "")} />
                  {isLast && caret}
                </div>
              </div>
            );
          case "codeblock":
            return (
              <React.Fragment key={idx}>
                <CodeBlockItem lang={block.lang} code={block.content || ""} />
                {isLast && caret}
              </React.Fragment>
            );
          case "empty":
            return <div key={idx} className="h-1.5" />;
          case "paragraph":
          default:
            return (
              <p key={idx} className="whitespace-pre-wrap break-words">
                <RenderInline tokens={parseInline(block.content || "")} />
                {isLast && caret}
              </p>
            );
        }
      })}
    </div>
  );
}

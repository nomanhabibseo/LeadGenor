"use client";

import type { MutableRefObject, ReactNode } from "react";
import { useCallback, useLayoutEffect, useRef } from "react";
import { mergeFieldTextToHighlightedHtml } from "@/lib/merge-highlight-html";
import { cn } from "@/lib/utils";

const pillChild =
  "[&_.merge-hl-pill]:inline [&_.merge-hl-pill]:rounded-md [&_.merge-hl-pill]:border [&_.merge-hl-pill]:border-violet-400/80 [&_.merge-hl-pill]:bg-violet-100/95 [&_.merge-hl-pill]:px-1.5 [&_.merge-hl-pill]:py-0.5 [&_.merge-hl-pill]:text-xs [&_.merge-hl-pill]:font-medium [&_.merge-hl-pill]:text-violet-900 dark:[&_.merge-hl-pill]:border-violet-500/50 dark:[&_.merge-hl-pill]:bg-violet-950/70 dark:[&_.merge-hl-pill]:text-violet-100";

const unsubPillChild =
  "[&_.merge-hl-unsub-pill]:inline [&_.merge-hl-unsub-pill]:rounded-md [&_.merge-hl-unsub-pill]:border [&_.merge-hl-unsub-pill]:border-sky-500/70 [&_.merge-hl-unsub-pill]:bg-sky-100/95 [&_.merge-hl-unsub-pill]:px-1.5 [&_.merge-hl-unsub-pill]:py-0.5 [&_.merge-hl-unsub-pill]:text-xs [&_.merge-hl-unsub-pill]:font-medium [&_.merge-hl-unsub-pill]:text-sky-950 dark:[&_.merge-hl-unsub-pill]:border-sky-400/60 dark:[&_.merge-hl-unsub-pill]:bg-sky-950/50 dark:[&_.merge-hl-unsub-pill]:text-sky-100";

type SelRange = { start: number; end: number };

type MergeHighlightInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "children" | "className"
> & {
  value: string;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  className?: string;
  /** Renders inside the same bordered shell on the right (e.g. Variables menu). */
  trailingSlot?: ReactNode;
  /** Updated on select/blur/key so inserts still work after opening the Variables menu (blur). */
  selectionRangeRef?: MutableRefObject<SelRange>;
};

/** Single-line input with visible `{{…}}` pills (mirror layer behind transparent text). */
function captureInputSelection(el: HTMLInputElement, ref?: MutableRefObject<SelRange>) {
  if (!ref) return;
  ref.current = {
    start: el.selectionStart ?? 0,
    end: el.selectionEnd ?? 0,
  };
}

export function MergeHighlightInput({
  value,
  onChange,
  inputRef,
  className,
  trailingSlot,
  selectionRangeRef,
  onScroll,
  ...rest
}: MergeHighlightInputProps) {
  const mirrorRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    const el = inputRef.current;
    const m = mirrorRef.current;
    if (!el || !m) return;
    m.scrollLeft = el.scrollLeft;
  }, [inputRef]);

  useLayoutEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  const core = (
    <>
      <div
        ref={mirrorRef}
        className="pointer-events-none absolute inset-0 z-0 overflow-x-auto overflow-y-hidden px-3 py-2"
        aria-hidden
      >
        <div
          className={cn(
            "inline-block min-h-[1.25rem] whitespace-pre text-left text-sm leading-normal text-slate-900 dark:text-slate-100",
            pillChild,
            unsubPillChild,
          )}
          dangerouslySetInnerHTML={{ __html: mergeFieldTextToHighlightedHtml(value) }}
        />
      </div>
      <input
        ref={inputRef}
        {...rest}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          queueMicrotask(() => {
            const el = inputRef.current;
            if (el) captureInputSelection(el, selectionRangeRef);
          });
        }}
        onSelect={(e) => {
          captureInputSelection(e.currentTarget, selectionRangeRef);
          rest.onSelect?.(e);
        }}
        onBlur={(e) => {
          captureInputSelection(e.currentTarget, selectionRangeRef);
          rest.onBlur?.(e);
        }}
        onKeyUp={(e) => {
          captureInputSelection(e.currentTarget, selectionRangeRef);
          rest.onKeyUp?.(e);
        }}
        onMouseUp={(e) => {
          captureInputSelection(e.currentTarget, selectionRangeRef);
          rest.onMouseUp?.(e);
        }}
        onScroll={(e) => {
          syncScroll();
          onScroll?.(e);
        }}
        className="relative z-10 w-full min-w-0 border-0 bg-transparent px-3 py-2 text-sm leading-normal text-transparent shadow-none outline-none ring-0 caret-slate-900 selection:bg-sky-200/80 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none dark:caret-slate-100 dark:selection:bg-sky-700/50"
        style={{ WebkitTextFillColor: "transparent" }}
        spellCheck={rest.spellCheck ?? false}
        autoComplete={rest.autoComplete ?? "off"}
      />
    </>
  );

  if (trailingSlot) {
    return (
      <div
        className={cn(
          "flex min-h-[2.5rem] w-full min-w-0 overflow-visible rounded-lg border border-slate-200 bg-white transition hover:border-sky-400 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/25 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-sky-500/50 dark:focus-within:border-sky-400 dark:focus-within:ring-sky-500/30",
          className,
        )}
      >
        <div className="relative min-h-[2.5rem] min-w-0 flex-1 overflow-hidden">{core}</div>
        <div className="relative z-30 flex shrink-0 items-stretch border-l border-slate-200 dark:border-slate-600">
          {trailingSlot}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative min-h-[2.5rem] w-full overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-sky-400 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/25 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-sky-500/50 dark:focus-within:border-sky-400 dark:focus-within:ring-sky-500/30",
        className,
      )}
    >
      {core}
    </div>
  );
}

type MergeHighlightTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "children" | "className"
> & {
  value: string;
  onChange: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  className?: string;
  selectionRangeRef?: MutableRefObject<SelRange>;
};

function captureTextareaSelection(el: HTMLTextAreaElement, ref?: MutableRefObject<SelRange>) {
  if (!ref) return;
  ref.current = {
    start: el.selectionStart ?? 0,
    end: el.selectionEnd ?? 0,
  };
}

export function MergeHighlightTextarea({
  value,
  onChange,
  textareaRef,
  className,
  selectionRangeRef,
  onScroll,
  ...rest
}: MergeHighlightTextareaProps) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const innerMirrorRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    const inner = innerMirrorRef.current;
    if (!ta || !inner) return;
    inner.style.transform = `translateY(-${ta.scrollTop}px)`;
    inner.style.width = `${ta.clientWidth}px`;
  }, [textareaRef]);

  useLayoutEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  return (
    <div
      className={cn(
        "relative grid w-full overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-sky-400 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/25 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-sky-500/50 dark:focus-within:border-sky-400 dark:focus-within:ring-sky-500/30",
        className,
      )}
    >
      <div
        ref={mirrorRef}
        className={cn(
          "pointer-events-none col-start-1 row-start-1 z-0 min-h-[240px] overflow-hidden px-3 py-3 font-sans text-sm leading-relaxed text-slate-900 dark:text-slate-100",
          pillChild,
          unsubPillChild,
        )}
        aria-hidden
      >
        <div
          ref={innerMirrorRef}
          className="whitespace-pre-wrap break-words"
          dangerouslySetInnerHTML={{ __html: mergeFieldTextToHighlightedHtml(value) }}
        />
      </div>
      <textarea
        ref={textareaRef}
        {...rest}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          queueMicrotask(() => {
            const el = textareaRef.current;
            if (el) captureTextareaSelection(el, selectionRangeRef);
          });
        }}
        onSelect={(e) => {
          captureTextareaSelection(e.currentTarget, selectionRangeRef);
          rest.onSelect?.(e);
        }}
        onBlur={(e) => {
          captureTextareaSelection(e.currentTarget, selectionRangeRef);
          rest.onBlur?.(e);
        }}
        onKeyUp={(e) => {
          captureTextareaSelection(e.currentTarget, selectionRangeRef);
          rest.onKeyUp?.(e);
        }}
        onMouseUp={(e) => {
          captureTextareaSelection(e.currentTarget, selectionRangeRef);
          rest.onMouseUp?.(e);
        }}
        onScroll={(e) => {
          syncScroll();
          onScroll?.(e);
        }}
        className="col-start-1 row-start-1 z-10 min-h-[240px] w-full resize-y border-0 bg-transparent px-3 py-3 font-sans text-sm leading-relaxed text-transparent shadow-none outline-none ring-0 caret-slate-900 selection:bg-sky-200/80 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none dark:caret-slate-100 dark:selection:bg-sky-700/50"
        style={{ WebkitTextFillColor: "transparent" }}
        spellCheck={rest.spellCheck ?? true}
      />
    </div>
  );
}

'use client';

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface TreeGuideProps {
  depth: number;
  ancestorHasNextSibling: boolean[];
  hasChildren: boolean;
  hasVisibleChildren: boolean;
  expanded: boolean;
  label: string;
  onToggle: () => void;
}

const vars = {
  '--tree-step': '20px',
  '--chevron-size': '20px',
  '--row-gap': '8px',
  '--tree-elbow': '14px',
} as React.CSSProperties;

const treeX = (level: number): React.CSSProperties => ({
  left: `calc(var(--tree-step) * ${level} + var(--chevron-size) / 2)`,
});

export default function TreeGuide({
  depth,
  ancestorHasNextSibling,
  hasChildren,
  hasVisibleChildren,
  expanded,
  label,
  onToggle,
}: TreeGuideProps) {
  const guideWidth = `calc(var(--tree-step) * ${depth} + var(--chevron-size))`;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          ...vars,
          position: 'absolute',
          left: 16,
          top: 0,
          bottom: 0,
          width: guideWidth,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        {Array.from({ length: depth }, (_, level) =>
          ancestorHasNextSibling[level] ? (
            <span key={level} className="tuw-tree-line tuw-tree-line-through" style={treeX(level)} />
          ) : null,
        )}
        {depth > 0 ? (
          <span className="tuw-tree-elbow" style={treeX(depth - 1)} />
        ) : null}
        {hasVisibleChildren && expanded ? (
          <span className="tuw-tree-line tuw-tree-line-parent" style={treeX(depth)} />
        ) : null}
      </div>

      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
          aria-expanded={expanded}
          style={{
            ...vars,
            marginLeft: `calc(var(--tree-step) * ${depth})`,
            width: 'var(--chevron-size)',
            height: 'var(--chevron-size)',
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <span
          style={{
            ...vars,
            display: 'inline-block',
            width: guideWidth,
            flexShrink: 0,
          }}
        />
      )}
    </>
  );
}

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

const SLOT = 14;
const SELF_SLOT = 22;

export default function TreeGuide({
  depth,
  ancestorHasNextSibling,
  hasChildren,
  hasVisibleChildren,
  expanded,
  label,
  onToggle,
}: TreeGuideProps) {
  const guideWidth = depth * SLOT + SELF_SLOT;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 8,
          top: 0,
          bottom: 0,
          width: guideWidth,
          pointerEvents: 'none',
          zIndex: 2,
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        {Array.from({ length: depth }, (_, level) => (
          <span key={level} className="tuw-tree-slot" style={{ width: SLOT }}>
            <span className={`tuw-tree-line${ancestorHasNextSibling[level] ? ' tuw-tree-line-through' : ''}`} />
            <span className="tuw-tree-branch" />
          </span>
        ))}
        <span className="tuw-tree-slot" style={{ width: SELF_SLOT }}>
          {depth > 0 ? <span className="tuw-tree-line" /> : null}
          {hasVisibleChildren && expanded ? <span className="tuw-tree-line tuw-tree-line-down" /> : null}
          {depth > 0 ? <span className="tuw-tree-branch" /> : null}
        </span>
      </div>

      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
          aria-expanded={expanded}
          style={{
            marginLeft: Math.max(0, guideWidth - 18),
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            padding: 2,
            flexShrink: 0,
          }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <span style={{ display: 'inline-block', width: guideWidth + 4, flexShrink: 0 }} />
      )}
    </>
  );
}

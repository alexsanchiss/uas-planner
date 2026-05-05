import React from 'react';
import { formatKey, isPlainObject, isPrimitive } from './json-viewer-utils';

// Re-export utilities so consumers can import them from this module.
export { formatKey, isPlainObject, isPrimitive } from './json-viewer-utils';

export interface JsonViewerSectionsProps {
  data: unknown;          // El JSON a renderizar (cualquier shape)
  className?: string;
  maxDepth?: number;      // Default: 6
}

// ── Recursive renderer ──────────────────────────────────────────────────────

interface NodeProps {
  value: unknown;
  depth: number;
  maxDepth: number;
}

const PrimitiveNode: React.FC<{ value: string | number | boolean | null | undefined }> = ({
  value,
}) => {
  const text =
    value === null
      ? 'null'
      : value === undefined
      ? 'undefined'
      : String(value);

  if (typeof value === 'string' && value.length > 120) {
    return (
      <p className="text-sm break-words" style={{ color: 'var(--text-primary)' }}>
        {text}
      </p>
    );
  }

  return (
    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
      {text}
    </span>
  );
};

const ArrayNode: React.FC<NodeProps> = ({ value, depth, maxDepth }) => {
  const arr = value as unknown[];

  if (arr.length === 0) {
    return (
      <span className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
        (empty)
      </span>
    );
  }

  return (
    <ul className="space-y-1 pl-1">
      {arr.map((item, i) => (
        <li key={i} className="flex gap-2 items-start">
          <span
            className="font-mono text-xs shrink-0 pt-0.5"
            style={{ color: 'var(--text-muted)' }}
          >
            [{i}]
          </span>
          <div className="min-w-0">
            <RecursiveNode value={item} depth={depth} maxDepth={maxDepth} />
          </div>
        </li>
      ))}
    </ul>
  );
};

const ObjectNodeDepth0: React.FC<NodeProps> = ({ value, depth, maxDepth }) => {
  const obj = value as Record<string, unknown>;
  return (
    <div className="space-y-6">
      {Object.entries(obj).map(([key, val]) => (
        <section key={key}>
          <h3
            className="font-semibold text-base border-b pb-1 mb-3"
            style={{
              color: 'var(--text-primary)',
              borderColor: 'var(--border-primary)',
            }}
          >
            {formatKey(key)}
          </h3>
          <RecursiveNode value={val} depth={depth + 1} maxDepth={maxDepth} />
        </section>
      ))}
    </div>
  );
};

const ObjectNodeDepth1: React.FC<NodeProps> = ({ value, depth, maxDepth }) => {
  const obj = value as Record<string, unknown>;
  return (
    <div className="space-y-4 pl-2">
      {Object.entries(obj).map(([key, val]) => (
        <div key={key}>
          <h4
            className="font-medium text-sm mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            {formatKey(key)}
          </h4>
          <div className="pl-2">
            <RecursiveNode value={val} depth={depth + 1} maxDepth={maxDepth} />
          </div>
        </div>
      ))}
    </div>
  );
};

const ObjectNodeDeep: React.FC<NodeProps> = ({ value, depth, maxDepth }) => {
  const obj = value as Record<string, unknown>;
  return (
    <dl className="space-y-1">
      {Object.entries(obj).map(([key, val]) => (
        <div key={key} className="flex gap-2 items-start flex-wrap">
          <dt
            className="font-mono text-xs shrink-0"
            style={{ color: 'var(--text-secondary)' }}
          >
            {key}:
          </dt>
          <dd className="text-sm mb-1 min-w-0" style={{ color: 'var(--text-primary)' }}>
            <RecursiveNode value={val} depth={depth + 1} maxDepth={maxDepth} />
          </dd>
        </div>
      ))}
    </dl>
  );
};

const RecursiveNode: React.FC<NodeProps> = ({ value, depth, maxDepth }) => {
  // maxDepth reached — show raw JSON
  if (depth >= maxDepth) {
    return (
      <pre
        className="text-xs overflow-x-auto rounded p-2"
        style={{
          color: 'var(--text-tertiary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (isPrimitive(value)) {
    return <PrimitiveNode value={value} />;
  }

  if (Array.isArray(value)) {
    return <ArrayNode value={value} depth={depth} maxDepth={maxDepth} />;
  }

  if (isPlainObject(value)) {
    if (depth === 0) return <ObjectNodeDepth0 value={value} depth={depth} maxDepth={maxDepth} />;
    if (depth === 1) return <ObjectNodeDepth1 value={value} depth={depth} maxDepth={maxDepth} />;
    return <ObjectNodeDeep value={value} depth={depth} maxDepth={maxDepth} />;
  }

  // Fallback for anything unexpected
  return (
    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
      {String(value)}
    </span>
  );
};

// ── Public component ────────────────────────────────────────────────────────

const JsonViewerSections: React.FC<JsonViewerSectionsProps> = ({
  data,
  className,
  maxDepth = 6,
}) => {
  return (
    <div className={className}>
      <RecursiveNode value={data} depth={0} maxDepth={maxDepth} />
    </div>
  );
};

export default JsonViewerSections;

import React, { useState, useMemo } from 'react';
import '../styles/MenuDiff.css';

function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function wineKey(wine) {
  return normalize(wine.producer) + '|' + normalize(wine.varietal) + '|' + normalize(wine.type);
}

function getChangedFields(existing, incoming) {
  // Only compare factual fields that the restaurant controls.
  // AI-estimated sensory fields (acidity, tannins, bodyWeight, sweetnessLevel, flavorProfile)
  // vary between AI runs and would cause false "changes" when re-uploading the same menu.
  const fields = ['year', 'region', 'price', 'type'];
  const changes = [];
  for (const f of fields) {
    const oldVal = String(existing[f] || '');
    const newVal = String(incoming[f] || '');
    if (oldVal !== newVal) {
      changes.push({ field: f, oldVal, newVal });
    }
  }
  return changes;
}

function MenuDiff({ newWines, existingWines, onApply, loading }) {
  const diff = useMemo(() => {
    const existingMap = new Map();
    existingWines.forEach(w => {
      existingMap.set(wineKey(w), w);
    });

    const newMap = new Map();
    newWines.forEach(w => {
      newMap.set(wineKey(w), w);
    });

    const added = [];
    const changed = [];
    const unchanged = [];
    const removed = [];

    // Check each new wine against existing
    newWines.forEach(w => {
      const key = wineKey(w);
      const existing = existingMap.get(key);
      if (!existing) {
        added.push({ wine: w, included: true });
      } else {
        const changes = getChangedFields(existing, w);
        if (changes.length > 0) {
          changed.push({ wine: w, existing, changes, included: true });
        } else {
          unchanged.push({ wine: w, existing });
        }
      }
    });

    // Check for removed wines (in existing but not in new)
    existingWines.forEach(w => {
      const key = wineKey(w);
      if (!newMap.has(key)) {
        removed.push({ wine: w, included: true });
      }
    });

    return { added, removed, changed, unchanged };
  }, [newWines, existingWines]);

  const [sections, setSections] = useState({
    added: true, removed: true, changed: true, unchanged: false
  });

  const [selections, setSelections] = useState(() => ({
    added: diff.added.map(() => true),
    removed: diff.removed.map(() => true),
    changed: diff.changed.map(() => true)
  }));

  const toggleSection = (section) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleSelection = (category, index) => {
    setSelections(prev => ({
      ...prev,
      [category]: prev[category].map((v, i) => i === index ? !v : v)
    }));
  };

  const hasNoChanges = diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0;

  const selectedCount = {
    added: selections.added.filter(Boolean).length,
    removed: selections.removed.filter(Boolean).length,
    changed: selections.changed.filter(Boolean).length
  };

  const totalSelected = selectedCount.added + selectedCount.removed + selectedCount.changed;

  const handleApply = () => {
    const operations = [];

    // Add selected new wines
    diff.added.forEach((item, i) => {
      if (selections.added[i]) {
        operations.push({ action: 'add', wine: item.wine });
      }
    });

    // Update selected changed wines
    diff.changed.forEach((item, i) => {
      if (selections.changed[i]) {
        operations.push({
          action: 'update',
          wineId: item.existing.wineId,
          wine: item.wine
        });
      }
    });

    // Delete selected removed wines
    diff.removed.forEach((item, i) => {
      if (selections.removed[i]) {
        operations.push({
          action: 'delete',
          wineId: item.wine.wineId
        });
      }
    });

    onApply(operations);
  };

  if (loading) {
    return (
      <div className="menu-diff">
        <div className="diff-loading">
          <div className="processing-spinner"></div>
          <p>Applying changes...</p>
        </div>
      </div>
    );
  }

  if (hasNoChanges) {
    return (
      <div className="menu-diff">
        <div className="no-changes">
          <h4>No Changes Detected</h4>
          <p>The uploaded menu matches your current wine list exactly.</p>
        </div>
      </div>
    );
  }

  const renderWineLabel = (wine) => (
    <div className="wine-info">
      <span className="wine-main">{wine.producer} — {wine.varietal}</span>
      <span className="wine-detail">{wine.region} | {wine.type} | ${wine.price}</span>
    </div>
  );

  const renderFieldDiff = (changes) => (
    changes.map(c => {
      if (c.field === 'flavorProfile') {
        const oldSet = new Set(c.oldVal);
        const newSet = new Set(c.newVal);
        const allFlavors = [...new Set([...c.oldVal, ...c.newVal])];
        return (
          <div key={c.field} style={{ marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>flavors: </span>
            <div className="diff-flavors">
              {allFlavors.map(f => {
                const wasIn = oldSet.has(f);
                const isIn = newSet.has(f);
                if (wasIn && isIn) return <span key={f} className="diff-flavor">{f}</span>;
                if (!wasIn && isIn) return <span key={f} className="diff-flavor flavor-added">+{f}</span>;
                return <span key={f} className="diff-flavor flavor-removed">{f}</span>;
              })}
            </div>
          </div>
        );
      }
      return (
        <div key={c.field} style={{ marginBottom: 2 }}>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>{c.field}: </span>
          <span className="field-old">{c.oldVal || '—'}</span>
          <span className="field-arrow">→</span>
          <span className="field-new">{c.newVal || '—'}</span>
        </div>
      );
    })
  );

  return (
    <div className="menu-diff">
      <div className="diff-header">
        <h3>Menu Changes</h3>
        <div className="diff-actions">
          <button
            className="apply-btn"
            disabled={totalSelected === 0}
            onClick={handleApply}
          >
            Apply {totalSelected} Change{totalSelected !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="diff-summary">
        {diff.added.length > 0 && (
          <span className="diff-summary-item added">{diff.added.length} to add</span>
        )}
        {diff.removed.length > 0 && (
          <span className="diff-summary-item removed">{diff.removed.length} to remove</span>
        )}
        {diff.changed.length > 0 && (
          <span className="diff-summary-item changed">{diff.changed.length} changed</span>
        )}
        <span className="diff-summary-item unchanged">{diff.unchanged.length} unchanged</span>
      </div>

      {/* Added wines */}
      {diff.added.length > 0 && (
        <div className="diff-section">
          <div className="diff-section-header added" onClick={() => toggleSection('added')}>
            <h4>New Wines ({diff.added.length})</h4>
            <span className="diff-section-toggle">{sections.added ? '▼' : '▶'}</span>
          </div>
          {sections.added && (
            <div className="diff-table-container">
              <table className="diff-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Wine</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Sensory Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.added.map((item, i) => (
                    <tr key={i} className="added-row">
                      <td>
                        <input
                          type="checkbox"
                          className="diff-checkbox"
                          checked={selections.added[i]}
                          onChange={() => toggleSelection('added', i)}
                        />
                      </td>
                      <td>{renderWineLabel(item.wine)}</td>
                      <td>{item.wine.type}</td>
                      <td>${item.wine.price}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>
                          {item.wine.acidity}/{item.wine.tannins}/{item.wine.bodyWeight}/{item.wine.sweetnessLevel}
                        </span>
                        <div className="diff-flavors" style={{ marginTop: 2 }}>
                          {(item.wine.flavorProfile || []).map(f => (
                            <span key={f} className="diff-flavor">{f}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Removed wines */}
      {diff.removed.length > 0 && (
        <div className="diff-section">
          <div className="diff-section-header removed" onClick={() => toggleSection('removed')}>
            <h4>Removed Wines ({diff.removed.length})</h4>
            <span className="diff-section-toggle">{sections.removed ? '▼' : '▶'}</span>
          </div>
          {sections.removed && (
            <div className="diff-table-container">
              <table className="diff-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Wine</th>
                    <th>Type</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.removed.map((item, i) => (
                    <tr key={i} className="removed-row">
                      <td>
                        <input
                          type="checkbox"
                          className="diff-checkbox"
                          checked={selections.removed[i]}
                          onChange={() => toggleSelection('removed', i)}
                        />
                      </td>
                      <td>{renderWineLabel(item.wine)}</td>
                      <td>{item.wine.type}</td>
                      <td>${item.wine.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Changed wines */}
      {diff.changed.length > 0 && (
        <div className="diff-section">
          <div className="diff-section-header changed" onClick={() => toggleSection('changed')}>
            <h4>Changed Wines ({diff.changed.length})</h4>
            <span className="diff-section-toggle">{sections.changed ? '▼' : '▶'}</span>
          </div>
          {sections.changed && (
            <div className="diff-table-container">
              <table className="diff-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Wine</th>
                    <th>Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.changed.map((item, i) => (
                    <tr key={i} className="changed-row">
                      <td>
                        <input
                          type="checkbox"
                          className="diff-checkbox"
                          checked={selections.changed[i]}
                          onChange={() => toggleSelection('changed', i)}
                        />
                      </td>
                      <td>{renderWineLabel(item.wine)}</td>
                      <td>{renderFieldDiff(item.changes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Unchanged wines */}
      {diff.unchanged.length > 0 && (
        <div className="diff-section">
          <div className="diff-section-header unchanged" onClick={() => toggleSection('unchanged')}>
            <h4>Unchanged ({diff.unchanged.length})</h4>
            <span className="diff-section-toggle">{sections.unchanged ? '▼' : '▶'}</span>
          </div>
          {sections.unchanged && (
            <div className="diff-table-container">
              <table className="diff-table">
                <thead>
                  <tr>
                    <th>Wine</th>
                    <th>Type</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.unchanged.map((item, i) => (
                    <tr key={i}>
                      <td>{renderWineLabel(item.wine)}</td>
                      <td>{item.wine.type}</td>
                      <td>${item.wine.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MenuDiff;

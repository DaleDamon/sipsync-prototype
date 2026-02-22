import React, { useState, useMemo } from 'react';
import '../styles/WineReviewTable.css';

const APPROVED_FLAVORS = [
  'oak', 'cherry', 'citrus', 'berry', 'vanilla', 'spice', 'floral',
  'chocolate', 'earthy', 'tropical', 'herbal', 'honey', 'pear', 'biscuit'
];

const TYPE_OPTIONS = ['red', 'white', 'rosé', 'sparkling', 'dessert'];
const ACIDITY_OPTIONS = ['low', 'medium', 'high'];
const TANNINS_OPTIONS = ['low', 'medium', 'high'];
const BODY_OPTIONS = ['light', 'medium', 'full'];
const SWEETNESS_OPTIONS = ['dry', 'medium', 'sweet'];

function WineReviewTable({ wines, onConfirm }) {
  const [rows, setRows] = useState(() =>
    wines.map((w, i) => ({ ...w, _id: i }))
  );
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const nextId = () => Math.max(0, ...rows.map(r => r._id)) + 1;

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r));
  };

  const toggleFlavor = (id, flavor) => {
    setRows(prev => prev.map(r => {
      if (r._id !== id) return r;
      const current = r.flavorProfile || [];
      const updated = current.includes(flavor)
        ? current.filter(f => f !== flavor)
        : [...current, flavor];
      return { ...r, flavorProfile: updated };
    }));
  };

  const addRow = () => {
    setRows(prev => [...prev, {
      _id: nextId(),
      year: '', producer: '', varietal: '', region: '',
      type: 'red', price: 0,
      acidity: 'medium', tannins: 'medium', bodyWeight: 'medium',
      sweetnessLevel: 'dry', flavorProfile: []
    }]);
  };

  const duplicateRow = (id) => {
    const source = rows.find(r => r._id === id);
    if (!source) return;
    const idx = rows.findIndex(r => r._id === id);
    const newRow = { ...source, _id: nextId() };
    const updated = [...rows];
    updated.splice(idx + 1, 0, newRow);
    setRows(updated);
  };

  const deleteRow = (id) => {
    setRows(prev => prev.filter(r => r._id !== id));
  };

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      let aVal = a[sortCol] || '';
      let bVal = b[sortCol] || '';
      if (sortCol === 'price') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortCol, sortDir]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors = [];
    rows.forEach((r, i) => {
      if (!r.producer?.trim()) errors.push(`Row ${i + 1}: missing producer`);
      if (!r.varietal?.trim()) errors.push(`Row ${i + 1}: missing varietal`);
      if (!r.type?.trim()) errors.push(`Row ${i + 1}: missing type`);
    });
    return errors;
  }, [rows]);

  const isInvalid = (row, field) => {
    const val = row[field];
    return !val || !String(val).trim();
  };

  const isLowConfidence = (row, field) => {
    return Array.isArray(row.lowConfidence) && row.lowConfidence.includes(field);
  };

  const lowConfidenceCount = useMemo(() => {
    return rows.filter(r => Array.isArray(r.lowConfidence) && r.lowConfidence.length > 0).length;
  }, [rows]);

  const handleConfirm = () => {
    // Strip internal _id and lowConfidence before passing up
    const cleaned = rows.map(({ _id, lowConfidence, ...rest }) => rest);
    onConfirm(cleaned);
  };

  const renderSortArrow = (col) => {
    if (sortCol !== col) return null;
    return <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="wine-review-table">
      <div className="wine-review-header">
        <h3>Review Wines ({rows.length})</h3>
        <div className="wine-review-actions">
          <button className="add-row-btn" onClick={addRow}>+ Add Wine</button>
          <button
            className="confirm-btn"
            disabled={validationErrors.length > 0 || rows.length === 0}
            onClick={handleConfirm}
          >
            Confirm {rows.length} Wines
          </button>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="validation-summary">
          {validationErrors.length} validation error{validationErrors.length > 1 ? 's' : ''}: {validationErrors.slice(0, 3).join('; ')}
          {validationErrors.length > 3 && ` ...and ${validationErrors.length - 3} more`}
        </div>
      )}

      {lowConfidenceCount > 0 && (
        <div className="confidence-summary">
          {lowConfidenceCount} wine{lowConfidenceCount > 1 ? 's have' : ' has'} fields flagged with low AI confidence (highlighted in amber). Please review these values.
        </div>
      )}

      <div className="review-table-container">
        <table className="review-table">
          <thead>
            <tr>
              <th className="col-actions"></th>
              <th className={`col-year ${sortCol === 'year' ? 'sort-active' : ''}`} onClick={() => handleSort('year')}>Year{renderSortArrow('year')}</th>
              <th className={`col-producer ${sortCol === 'producer' ? 'sort-active' : ''}`} onClick={() => handleSort('producer')}>Producer{renderSortArrow('producer')}</th>
              <th className={`col-varietal ${sortCol === 'varietal' ? 'sort-active' : ''}`} onClick={() => handleSort('varietal')}>Varietal{renderSortArrow('varietal')}</th>
              <th className={`col-region ${sortCol === 'region' ? 'sort-active' : ''}`} onClick={() => handleSort('region')}>Region{renderSortArrow('region')}</th>
              <th className={`col-type ${sortCol === 'type' ? 'sort-active' : ''}`} onClick={() => handleSort('type')}>Type{renderSortArrow('type')}</th>
              <th className={`col-price ${sortCol === 'price' ? 'sort-active' : ''}`} onClick={() => handleSort('price')}>Price{renderSortArrow('price')}</th>
              <th className="col-acidity" onClick={() => handleSort('acidity')}>Acidity{renderSortArrow('acidity')}</th>
              <th className="col-tannins" onClick={() => handleSort('tannins')}>Tannins{renderSortArrow('tannins')}</th>
              <th className="col-body" onClick={() => handleSort('bodyWeight')}>Body{renderSortArrow('bodyWeight')}</th>
              <th className="col-sweetness" onClick={() => handleSort('sweetnessLevel')}>Sweet{renderSortArrow('sweetnessLevel')}</th>
              <th className="col-flavors">Flavors</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row._id}>
                <td className="col-actions">
                  <div className="row-actions">
                    <button className="row-action-btn duplicate" title="Duplicate" onClick={() => duplicateRow(row._id)}>⧉</button>
                    <button className="row-action-btn delete" title="Delete" onClick={() => deleteRow(row._id)}>✕</button>
                  </div>
                </td>
                <td className="col-year">
                  <input type="text" value={row.year || ''} onChange={e => updateRow(row._id, 'year', e.target.value)} placeholder="—" />
                </td>
                <td className="col-producer">
                  <input type="text" className={isInvalid(row, 'producer') ? 'invalid' : ''} value={row.producer || ''} onChange={e => updateRow(row._id, 'producer', e.target.value)} placeholder="Required" />
                </td>
                <td className="col-varietal">
                  <input type="text" className={isInvalid(row, 'varietal') ? 'invalid' : ''} value={row.varietal || ''} onChange={e => updateRow(row._id, 'varietal', e.target.value)} placeholder="Required" />
                </td>
                <td className="col-region">
                  <input type="text" value={row.region || ''} onChange={e => updateRow(row._id, 'region', e.target.value)} placeholder="—" />
                </td>
                <td className="col-type">
                  <select className={isInvalid(row, 'type') ? 'invalid' : ''} value={row.type || ''} onChange={e => updateRow(row._id, 'type', e.target.value)}>
                    <option value="">—</option>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="col-price">
                  <input type="number" value={row.price || ''} onChange={e => updateRow(row._id, 'price', e.target.value)} min="0" step="0.5" />
                </td>
                <td className={`col-acidity ${isLowConfidence(row, 'acidity') ? 'low-confidence' : ''}`}>
                  <select value={row.acidity || 'medium'} onChange={e => updateRow(row._id, 'acidity', e.target.value)}>
                    {ACIDITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className={`col-tannins ${isLowConfidence(row, 'tannins') ? 'low-confidence' : ''}`}>
                  <select value={row.tannins || 'medium'} onChange={e => updateRow(row._id, 'tannins', e.target.value)}>
                    {TANNINS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className={`col-body ${isLowConfidence(row, 'bodyWeight') ? 'low-confidence' : ''}`}>
                  <select value={row.bodyWeight || 'medium'} onChange={e => updateRow(row._id, 'bodyWeight', e.target.value)}>
                    {BODY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className={`col-sweetness ${isLowConfidence(row, 'sweetnessLevel') ? 'low-confidence' : ''}`}>
                  <select value={row.sweetnessLevel || 'dry'} onChange={e => updateRow(row._id, 'sweetnessLevel', e.target.value)}>
                    {SWEETNESS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className={`col-flavors ${isLowConfidence(row, 'flavorProfile') ? 'low-confidence' : ''}`}>
                  <div className="flavor-picker">
                    {APPROVED_FLAVORS.map(f => (
                      <span
                        key={f}
                        className={`flavor-chip ${(row.flavorProfile || []).includes(f) ? 'selected' : ''}`}
                        onClick={() => toggleFlavor(row._id, f)}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="review-footer">
        <span>{rows.length} wine{rows.length !== 1 ? 's' : ''} total</span>
        <span>{validationErrors.length === 0 ? 'Ready to confirm' : `${validationErrors.length} error${validationErrors.length !== 1 ? 's' : ''}`}</span>
      </div>
    </div>
  );
}

export default WineReviewTable;

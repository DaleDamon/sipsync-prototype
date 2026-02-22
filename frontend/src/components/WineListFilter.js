import React, { useState, useEffect } from 'react';
import '../styles/WineListFilter.css';

function WineListFilter({ wines, onFilterChange }) {
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [filteredWines, setFilteredWines] = useState(wines);

  useEffect(() => {
    applyFilters();
  }, [wines, searchText, typeFilter]);

  const applyFilters = () => {
    let filtered = wines;

    // Search filter (case-insensitive, matches producer, varietal, or region)
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(wine =>
        (wine.producer && wine.producer.toLowerCase().includes(search)) ||
        (wine.varietal && wine.varietal.toLowerCase().includes(search)) ||
        (wine.region && wine.region.toLowerCase().includes(search))
      );
    }

    // Type filter (exact match)
    if (typeFilter) {
      filtered = filtered.filter(wine => wine.type === typeFilter);
    }

    setFilteredWines(filtered);
    onFilterChange(filtered);
  };

  const handleSearch = (e) => {
    setSearchText(e.target.value);
  };

  const handleTypeFilter = (e) => {
    setTypeFilter(e.target.value);
  };

  const handleClearFilters = () => {
    setSearchText('');
    setTypeFilter('');
  };

  const hasActiveFilters = searchText.trim() || typeFilter;

  return (
    <div className="wine-list-filter">
      <input
        type="text"
        className="filter-search"
        placeholder="Search wines by producer, varietal, or region..."
        value={searchText}
        onChange={handleSearch}
      />

      <select
        className="filter-type"
        value={typeFilter}
        onChange={handleTypeFilter}
      >
        <option value="">All Types</option>
        <option value="red">Red</option>
        <option value="white">White</option>
        <option value="rosé">Rosé</option>
        <option value="rose">Rose</option>
        <option value="sparkling">Sparkling</option>
        <option value="dessert">Dessert</option>
      </select>

      {hasActiveFilters && (
        <button className="clear-filters-btn" onClick={handleClearFilters}>
          Clear Filters
        </button>
      )}

      <span className="filter-results">
        Showing {filteredWines.length} of {wines.length} wines
      </span>
    </div>
  );
}

export default WineListFilter;

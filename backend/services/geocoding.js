const axios = require('axios');

const GEOCODING_PROVIDER = process.env.GEOCODING_PROVIDER || 'google';

/**
 * Geocode an address to get coordinates
 * @param {Object} address - Address object with street, city, state, zipCode, country
 * @returns {Promise<Object>} - { latitude, longitude, accuracy, formattedAddress }
 */
async function geocodeAddress(address) {
  const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country}`;

  switch (GEOCODING_PROVIDER) {
    case 'google':
      return await geocodeWithGoogle(fullAddress);
    case 'opencage':
      return await geocodeWithOpenCage(fullAddress);
    case 'nominatim':
      return await geocodeWithNominatim(fullAddress);
    default:
      throw new Error(`Unknown geocoding provider: ${GEOCODING_PROVIDER}`);
  }
}

/**
 * Geocode using Google Maps Geocoding API
 */
async function geocodeWithGoogle(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY not configured in environment variables');
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: address,
        key: apiKey
      },
      timeout: 10000 // 10 second timeout
    });

    if (response.data.status === 'ZERO_RESULTS') {
      throw new Error('Address not found. Please verify the address is correct.');
    }

    if (response.data.status === 'REQUEST_DENIED') {
      throw new Error('Geocoding API request denied. Check your API key and permissions.');
    }

    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
    }

    const result = response.data.results[0];

    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      accuracy: result.geometry.location_type, // ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE
      formattedAddress: result.formatted_address
    };
  } catch (error) {
    if (error.response) {
      // HTTP error from Google API
      throw new Error(`Geocoding API error: ${error.response.status} - ${error.response.statusText}`);
    } else if (error.request) {
      // Network error
      throw new Error('Network error connecting to geocoding service');
    } else {
      // Re-throw custom errors
      throw error;
    }
  }
}

/**
 * Geocode using OpenCage Geocoding API
 */
async function geocodeWithOpenCage(address) {
  const apiKey = process.env.OPENCAGE_API_KEY;

  if (!apiKey) {
    throw new Error('OPENCAGE_API_KEY not configured in environment variables');
  }

  try {
    const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
      params: {
        q: address,
        key: apiKey,
        limit: 1
      },
      timeout: 10000
    });

    if (response.data.results.length === 0) {
      throw new Error('Address not found. Please verify the address is correct.');
    }

    const result = response.data.results[0];

    return {
      latitude: result.geometry.lat,
      longitude: result.geometry.lng,
      accuracy: result.confidence >= 9 ? 'ROOFTOP' : 'APPROXIMATE',
      formattedAddress: result.formatted
    };
  } catch (error) {
    if (error.response) {
      throw new Error(`OpenCage API error: ${error.response.status}`);
    } else if (error.request) {
      throw new Error('Network error connecting to geocoding service');
    } else {
      throw error;
    }
  }
}

/**
 * Geocode using Nominatim (OpenStreetMap)
 */
async function geocodeWithNominatim(address) {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: address,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'SipSync/1.0' // Required by Nominatim usage policy
      },
      timeout: 10000
    });

    if (response.data.length === 0) {
      throw new Error('Address not found. Please verify the address is correct.');
    }

    const result = response.data[0];

    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      accuracy: 'APPROXIMATE',
      formattedAddress: result.display_name
    };
  } catch (error) {
    if (error.response) {
      throw new Error(`Nominatim API error: ${error.response.status}`);
    } else if (error.request) {
      throw new Error('Network error connecting to geocoding service');
    } else {
      throw error;
    }
  }
}

module.exports = {
  geocodeAddress
};

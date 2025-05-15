import { createClient } from '@/lib/supabase'

const supabase = createClient()

const API_BASE_URL = 'https://web.gentlemeadow-727fb9e6.westus.azurecontainerapps.io'; // or your production API URL

export const fetchClubManifest = async (page = 1, limit = 20, category = null) => {
  try {
    // Build the query string with pagination and optional category filter
    let queryParams = `page=${page}&limit=${limit}`;
    if (category) {
      queryParams += `&category=${encodeURIComponent(category)}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/club?${queryParams}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch clubs: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    console.log('Fetched club manifest:', data);
    
    return {
      results: data.results || [],
      totalCount: data.total || 0,
      hasMore: data.hasMore || false,
      page: data.page || page,
      totalPages: data.pages || 1
    };
  } catch (error) {
    console.error('Error fetching club manifest:', error);
    // Return a safe fallback value
    return { results: [], totalCount: 0, hasMore: false, page: 1, totalPages: 1 };
  }
};

// Function to fetch more clubs with pagination
export const fetchMoreClubs = async (page, limit = 20, category = null) => {
  return fetchClubManifest(page, limit, category);
};

// Function to fetch clubs with specific category
export const fetchClubsByCategory = async (category, page = 1, limit = 20) => {
  return fetchClubManifest(page, limit, category);
};

export const fetchClubData = async (username) => {
  try {
    const url = `${API_BASE_URL}/club/${username}`;
    console.log(`Fetching data for club ${username} from:`, url);
  
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch club data: ${response.status} ${response.statusText} - ${errorText}`);
    }
  
    const data = await response.json();
    console.log(`Fetched data for club ${username}:`, data);
    return data;
  } catch (error) {
    console.error(`Error fetching club data for ${username}:`, error);
    throw error;
  }
};
export const fetchSmartSearch = async (query, page = 1, limit = 20, category = null) => {
  try {
    let queryParams = `q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    if (category) {
      queryParams += `&category=${encodeURIComponent(category)}`;
    }

    const response = await fetch(`${API_BASE_URL}/smart-search?${queryParams}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch smart search: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      results: data.results || [],
      totalCount: data.count || 0,
      hasMore: data.hasMore || false,
      page: data.page || page,
    };
  } catch (error) {
    console.error('Error fetching smart search:', error);
    return { results: [], totalCount: 0, hasMore: false, page: 1 };
  }
};

export const fetchClubPosts = async (username, page = 1, limit = 10) => {
  try {
    const url = `${API_BASE_URL}/club/${username}/posts?page=${page}&limit=${limit}`;
    const response = await fetch(url);
  
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch posts: ${response.status} - ${text}`);
    }
  
    const json = await response.json();
    return {
      results: json.results || [],
      hasMore: json.hasMore || false,
      page: json.page || page,
      totalPages: json.pages || 1
    };
  } catch (error) {
    console.error(`Error fetching posts for ${username}:`, error);
    return { results: [], hasMore: false, page: 1, totalPages: 1 };
  }
};

export const fetchClubEvents = async (username, page = 1, limit = 10) => {
  try {
    const url = `${API_BASE_URL}/club/${username}/events?page=${page}&limit=${limit}`;
    const response = await fetch(url);
  
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch events: ${response.status} - ${text}`);
    }
  
    const json = await response.json();
    return {
      results: json.results || [],
      hasMore: json.hasMore || false,
      page: json.page || page,
      totalPages: json.pages || 1
    };
  } catch (error) {
    console.error(`Error fetching events for ${username}:`, error);
    return { results: [], hasMore: false, page: 1, totalPages: 1 };
  }
};

export const getCalendarUrl = (username) => {
  return `${API_BASE_URL}/club/${username}/calendar.ics`;
};

export const submitNewClub = async (clubData) => {
  try {
    // ✅ Get the current session
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('User is not authenticated')
    }

    const token = session.access_token

    // ✅ Attach Authorization header with Bearer token
    const response = await fetch(`${API_BASE_URL}/club/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // <-- Add this
      },
      body: JSON.stringify(clubData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to submit new club: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Successfully submitted new club:', data);
    return data;
  } catch (error) {
    console.error('Error submitting new club:', error);
    throw error;
  }
};
export const fetchHybridSearch = async (
  query, 
  page = 1, 
  limit = 20, 
  category = null,
  semanticWeight = 0.5
) => {
  try {
    // Check for authentication first
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Authentication required for hybrid search')
    }

    const token = session.access_token
    
    // Build the query string with all parameters
    let queryParams = `q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    
    // Add optional parameters if provided
    if (category) {
      queryParams += `&category=${encodeURIComponent(category)}`;
    }
    
    // Add semantic weight parameter
    queryParams += `&semantic_weight=${semanticWeight}`;

    const response = await fetch(`${API_BASE_URL}/hybrid-search?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch hybrid search: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    console.log('Fetched hybrid search results:', data);
    
    return {
      results: data.results || [],
      totalCount: data.count || 0,
      hasMore: data.hasMore || false,
      page: data.page || page
    };
  } catch (error) {
    console.error('Error fetching hybrid search:', error);
    // We'll rethrow to handle in the component
    throw error;
  }
};
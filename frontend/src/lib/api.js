const API_BASE_URL = 'https://rocky-eyrie-73493-0fd3b2ef381b.herokuapp.com/';

export const fetchClubManifest = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/club-manifest`);
      if (!response.ok) throw new Error('Failed to fetch clubs');
      const data = await response.json();
  
      // Log the fetched data to inspect its structure
      console.log('Fetched club manifest:', data);
  
      return data;
    } catch (error) {
      console.error('Error fetching club manifest:', error);
      throw error;
      //need to push
    }
  };

  export const fetchJobDetails = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/job-status`);
      if (!response.ok) throw new Error("Failed to fetch job status");
      return response.json();
    } catch (error) { 
      console.error("Error fetching job details:", error);
      return null;
    }
  };
  

  export const fetchClubData = async (username) => {
    try {
      const url = `${API_BASE_URL}/club/${username}`;
      console.log(`Fetching data for club ${username} from:`, url); // Log the API URL
  
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text(); // Log the response body for more details
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

export const fetchClubPosts = async (username) => {
  try {
    const response = await fetch(`${API_BASE_URL}/club/${username}/posts`);
    if (!response.ok) throw new Error('Failed to fetch club posts');
    return await response.json();
  } catch (error) {
    console.error('Error fetching club posts:', error);
    throw error;
  }
};

export const getCalendarUrl = (username) => {
  return `${API_BASE_URL}/club/${username}/calendar.ics`;
};
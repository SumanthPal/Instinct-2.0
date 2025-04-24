const API_BASE_URL = 'http://0.0.0.0:8000';

export const fetchClubManifest = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/club`);
      if (!response.ok) throw new Error('Failed to fetch clubs');
      const data = await response.json();
  
      // Log the fetched data to inspect its structure
      console.log('Fetched club manifest:', data);
  
      return data["results"];
    } catch (error) {
      console.error('Error fetching club manifest:', error);
      throw error;
      //need to push
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
      const url = `${API_BASE_URL}/club/${username}/posts`;
      const response = await fetch(url);
  
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch posts: ${response.status} - ${text}`);
      }
  
      const json = await response.json();
      return json.results ?? []; // Fallback to empty array
    } catch (error) {
      console.error(`Error fetching posts for ${username}:`, error);
      return []; // Return safe fallback so getServerSideProps can serialize it
    }
  };
  

  export const fetchClubEvents = async (username) => {
    try {
      const url = `${API_BASE_URL}/club/${username}/events`;
      const response = await fetch(url);
  
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch events: ${response.status} - ${text}`);
      }
  
      const json = await response.json();
      return json.results ?? [];
    } catch (error) {
      console.error(`Error fetching events for ${username}:`, error);
      return [];
    }
  };
  


export const getCalendarUrl = (username) => {
  return `${API_BASE_URL}/club/${username}/calendar.ics`;
};
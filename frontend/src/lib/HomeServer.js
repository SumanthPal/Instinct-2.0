import { fetchClubManifest, fetchJobDetails } from '../lib/api';
import HomeClient from './HomeClient';

export default async function HomeServer() {
  let manifest = [];
  try {
    // Fetch the club manifest (contains all necessary data)
    manifest = await fetchClubManifest();
  } catch (error) {
    console.error('Failed to fetch club manifest:', error);
  }

  // Fetch job details
  

  // Pass the manifest directly to HomeClient
  return <HomeClient detailedClubs={manifest} />;
}
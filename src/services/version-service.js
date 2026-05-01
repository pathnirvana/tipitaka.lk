import { IOS, platform, bundleId } from '../constants';
import axios from 'axios'

export const getLatestVersionAvailable = async () => {
  if (platform === IOS) {
    try {
      const url = `https://itunes.apple.com/lookup?bundleId=${bundleId}`;
      const response = await axios.get(url);

      // Check if the response contains data
      if (response.data.resultCount > 0) {
        console.log("response.data.results[0].version>>"+response.data.results[0].version);
        return response.data.results[0].version;
      } else {``
        throw new Error('No results found for the provided bundle ID');
      }
    } catch (error) {
      console.error('Error checking for update:', error.message);
      return -1
    }
  } else {
    try {
      const response = await axios.get('https://tipitaka.lk/tipitaka-query/version')
      return Number(response.data.split('v').pop()) // returns something like "Tipitaka.lk v2.0"
    } catch (error) {
      console.log('Error checking for update:', error.message)
      return -1
    }
  }
}
import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';

/** Guest-accessible landing demo config (no JWT). */
export async function fetchPublicHeroDemo() {
  const res = await axios.get(`${getApiBaseUrl()}/api/public/demo`);
  return res.data;
}

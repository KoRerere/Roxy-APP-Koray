import nodeGeocoder from 'node-geocoder';
import geoTz from 'geo-tz/all';

export async function getTimezoneByCity(city: string, country: string) {
  const geocoder = nodeGeocoder({
    provider: 'openstreetmap'
  });
  let query = city;
  if (country) {
    query += `, ${country}`;
  }
  const res = await geocoder.geocode(query);
  if (!res || res.length === 0) {
    console.warn(`timezoneByCity: \`${query}\` not get result`)
    return null;
  }
  const { latitude, longitude } = res[0];
  if (latitude == null || longitude == null) {
    console.warn(`timezoneByCity: \`${query}\` not get latitude or longitude`)
    return null;
  }
  const timezone = geoTz.find(latitude, longitude);
  if (!timezone || timezone.length === 0) {
    console.warn(`timezoneByCity: \`${query}\` not get timezone`)
    return null;
  }
  return timezone[0];
}

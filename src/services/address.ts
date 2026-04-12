// Philippine Standard Geographic Code (PSGC) API service
// Provides address data for provinces, cities/municipalities, and barangays

export interface Province {
  code: string;
  name: string;
  regionCode: string;
}

export interface CityMunicipality {
  code: string;
  name: string;
  provinceCode: string;
}

export interface Barangay {
  code: string;
  name: string;
  cityMunicipalityCode: string;
}

class AddressService {
  private readonly baseUrl = 'https://psgc.gitlab.io/api';

  /**
   * Fetch provinces for Central Luzon (Region III)
   * Limited to Bulacan and Pampanga as per business requirements
   */
  async getProvinces(): Promise<Province[]> {
    try {
      const response = await fetch(`${this.baseUrl}/regions/030000000/provinces/`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // Filter to only include Bulacan and Pampanga
      const filteredProvinces = data.filter((province: any) => 
        province.name === 'Bulacan' || province.name === 'Pampanga'
      );
      
      return filteredProvinces.map((province: any) => ({
        code: province.code,
        name: province.name,
        regionCode: province.regionCode
      }));
    } catch (error) {
      console.error('Error fetching provinces:', error);
      throw new Error('Failed to load provinces. Please check your internet connection.');
    }
  }

  /**
   * Fetch cities/municipalities for a given province
   * For Bulacan, only Baliwag is shown. For Pampanga, all cities are shown.
   */
  async getCitiesByProvince(provinceCode: string): Promise<CityMunicipality[]> {
    try {
      const response = await fetch(`${this.baseUrl}/provinces/${provinceCode}/cities-municipalities/`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // Get province name to apply filtering
      const provinces = await this.getProvinces();
      const selectedProvince = provinces.find(p => p.code === provinceCode);
      
      let filteredCities = data;
      
      // If Bulacan is selected, only show Baliwag
      if (selectedProvince && selectedProvince.name === 'Bulacan') {
        filteredCities = data.filter((city: any) => 
          city.name.toLowerCase().includes('baliwag') || 
          city.name.toLowerCase().includes('baliuag')
        );
      }
      // If Pampanga is selected, show all cities/municipalities
      
      return filteredCities.map((city: any) => ({
        code: city.code,
        name: city.name,
        provinceCode: city.provinceCode
      }));
    } catch (error) {
      console.error('Error fetching cities:', error);
      throw new Error('Failed to load cities/municipalities. Please check your internet connection.');
    }
  }

  /**
   * Fetch barangays for a given city/municipality
   */
  async getBarangaysByCity(cityCode: string): Promise<Barangay[]> {
    try {
      const response = await fetch(`${this.baseUrl}/cities-municipalities/${cityCode}/barangays/`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      return data.map((barangay: any) => ({
        code: barangay.code,
        name: barangay.name,
        cityMunicipalityCode: barangay.cityMunicipalityCode
      }));
    } catch (error) {
      console.error('Error fetching barangays:', error);
      throw new Error('Failed to load barangays. Please check your internet connection.');
    }
  }

  /**
   * Get full address string from codes
   */
  async getFullAddress(provinceCode: string, cityCode: string, barangayCode: string, street: string): Promise<string> {
    try {
      const [provinces, cities, barangays] = await Promise.all([
        this.getProvinces(),
        this.getCitiesByProvince(provinceCode),
        this.getBarangaysByCity(cityCode)
      ]);

      const province = provinces.find(p => p.code === provinceCode);
      const city = cities.find(c => c.code === cityCode);
      const barangay = barangays.find(b => b.code === barangayCode);

      const addressParts = [
        street,
        barangay?.name,
        city?.name,
        province?.name
      ].filter(Boolean);

      return addressParts.join(', ');
    } catch (error) {
      console.error('Error constructing full address:', error);
      return '';
    }
  }
}

// Export singleton instance
export const addressService = new AddressService();

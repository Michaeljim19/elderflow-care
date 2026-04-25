export interface CaregiverAddress {
  province: string
  city_municipality: string
  barangay: string
  street: string
}

export interface CaregiverAddressFields extends CaregiverAddress {
  address: CaregiverAddress
  city: string
  street_address: string
}

const createEmptyCaregiverAddress = (): CaregiverAddress => ({
  province: '',
  city_municipality: '',
  barangay: '',
  street: ''
})

const normalizeAddressString = (value: string): CaregiverAddress => {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return createEmptyCaregiverAddress()
  }

  try {
    const parsedValue = JSON.parse(trimmedValue)
    if (parsedValue && typeof parsedValue === 'object') {
      return normalizeCaregiverAddress(parsedValue)
    }
  } catch {
    const parts = trimmedValue.split(',').map(part => part.trim()).filter(Boolean)

    if (parts.length >= 4) {
      return {
        street: parts.slice(0, parts.length - 3).join(', '),
        barangay: parts[parts.length - 3],
        city_municipality: parts[parts.length - 2],
        province: parts[parts.length - 1]
      }
    }

    return {
      province: '',
      city_municipality: '',
      barangay: '',
      street: trimmedValue
    }
  }

  return createEmptyCaregiverAddress()
}

const normalizeAddressObject = (value: Record<string, any>): CaregiverAddress => {
  const nestedAddress = value.address ? normalizeCaregiverAddress(value.address) : createEmptyCaregiverAddress()
  const directAddress = {
    province: String(value.province || value.province_name || nestedAddress.province || '').trim(),
    city_municipality: String(value.city_municipality || value.city || value.municipality || value.city_name || nestedAddress.city_municipality || '').trim(),
    barangay: String(value.barangay || value.barangay_name || nestedAddress.barangay || '').trim(),
    street: String(value.street || value.street_address || value.address_line || nestedAddress.street || '').trim()
  }

  return directAddress
}

export const normalizeCaregiverAddress = (value: unknown): CaregiverAddress => {
  if (!value) {
    return createEmptyCaregiverAddress()
  }

  if (typeof value === 'string') {
    return normalizeAddressString(value)
  }

  if (typeof value === 'object') {
    return normalizeAddressObject(value as Record<string, any>)
  }

  return createEmptyCaregiverAddress()
}

export const buildCaregiverAddressFields = (value: unknown): CaregiverAddressFields => {
  const address = normalizeCaregiverAddress(value)

  return {
    address,
    province: address.province,
    city: address.city_municipality,
    city_municipality: address.city_municipality,
    barangay: address.barangay,
    street: address.street,
    street_address: address.street
  }
}

export const buildApprovedCaregiverState = () => ({
  status: 'Active' as const,
  is_active: true,
  verified: true,
  emailVerified: true,
  email_verified: true,
  auth_created: true
})

export const isApprovedCaregiverRecord = (value: Record<string, any> | null | undefined): boolean => {
  if (!value) {
    return false
  }

  return Boolean(
    value.auth_created === true ||
    value.verified === true ||
    value.emailVerified === true ||
    value.email_verified === true
  )
}
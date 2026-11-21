import * as XLSX from 'xlsx';

export interface ClientValidationError {
  row: number;
  field: string;
  value: any;
  message: string;
}

export interface ClientValidationResult {
  valid: boolean;
  totalRows: number;
  validCandidates: { fullName: string; phoneNumber: string; email?: string }[];
  errors: ClientValidationError[];
}

export const validateSpreadsheetClient = async (file: File): Promise<ClientValidationResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return {
      valid: false,
      totalRows: 0,
      validCandidates: [],
      errors: [{ row: 0, field: 'file', value: '', message: 'The uploaded spreadsheet contains no sheets.' }]
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) {
    return {
      valid: false,
      totalRows: 0,
      validCandidates: [],
      errors: [{ row: 0, field: 'file', value: '', message: 'The spreadsheet is empty. Please add candidate rows.' }]
    };
  }

  const errors: ClientValidationError[] = [];
  const validCandidates: { fullName: string; phoneNumber: string; email?: string }[] = [];
  const seenPhones = new Set<string>();

  rawRows.forEach((row, index) => {
    const rowNum = index + 2; // +1 for 0-index, +1 for header row

    // Normalize field headers (case insensitive)
    const fullNameKey = Object.keys(row).find((k) =>
      ['fullname', 'name', 'candidate_name', 'candidatename'].includes(k.toLowerCase().replace(/[\s_]/g, ''))
    );
    const phoneKey = Object.keys(row).find((k) =>
      ['phonenumber', 'phone', 'mobile', 'mobilenumber', 'contact'].includes(k.toLowerCase().replace(/[\s_]/g, ''))
    );
    const emailKey = Object.keys(row).find((k) =>
      ['email', 'emailaddress', 'mail'].includes(k.toLowerCase().replace(/[\s_]/g, ''))
    );

    const fullName = fullNameKey ? String(row[fullNameKey]).trim() : '';
    const rawPhone = phoneKey ? String(row[phoneKey]).trim() : '';
    const email = emailKey ? String(row[emailKey]).trim() : '';

    // Clean phone number (remove spaces, hyphens, +91)
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      cleanPhone = cleanPhone.substring(2);
    }

    // 1. Full name validation
    if (!fullName) {
      errors.push({
        row: rowNum,
        field: 'fullName',
        value: rawPhone,
        message: 'Candidate full name is missing.'
      });
    }

    // 2. Phone number validation (10 digits starting with 6, 7, 8, or 9)
    if (!cleanPhone) {
      errors.push({
        row: rowNum,
        field: 'phoneNumber',
        value: rawPhone,
        message: 'Phone number is missing.'
      });
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      errors.push({
        row: rowNum,
        field: 'phoneNumber',
        value: rawPhone,
        message: 'Invalid phone number. Must be a valid 10-digit Indian mobile number.'
      });
    } else if (seenPhones.has(cleanPhone)) {
      errors.push({
        row: rowNum,
        field: 'phoneNumber',
        value: rawPhone,
        message: `Duplicate phone number within this batch: ${cleanPhone}`
      });
    } else {
      seenPhones.add(cleanPhone);
    }

    // 3. Email validation (if provided)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({
        row: rowNum,
        field: 'email',
        value: email,
        message: 'Invalid email address format.'
      });
    }

    if (errors.length === 0) {
      validCandidates.push({
        fullName,
        phoneNumber: cleanPhone,
        email: email || undefined
      });
    }
  });

  return {
    valid: errors.length === 0,
    totalRows: rawRows.length,
    validCandidates: errors.length === 0 ? validCandidates : [],
    errors
  };
};

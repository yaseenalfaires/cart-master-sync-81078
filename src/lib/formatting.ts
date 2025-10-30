// Convert Eastern Arabic numerals to Western Arabic numerals
const toWesternNumerals = (str: string): string => {
  const easternNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const westernNumerals = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  let result = str;
  easternNumerals.forEach((eastern, index) => {
    result = result.replace(new RegExp(eastern, 'g'), westernNumerals[index]);
  });
  return result;
};

// Format currency with Western Arabic numerals only
export const formatCurrency = (amount: number, currency: string = 'LYD'): string => {
  const currencySymbols: { [key: string]: string } = {
    LYD: 'د.ل'
  };

  const formatted = amount.toFixed(2);
  const symbol = currencySymbols[currency] || 'د.ل';
  
  // Ensure Western numerals
  return toWesternNumerals(`${formatted} ${symbol}`);
};

// Format date to Gregorian with Western Arabic numerals
export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const formatted = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return toWesternNumerals(formatted);
};

// Format time with Western Arabic numerals
export const formatTime = (timestamp: string | Date): string => {
  const dateObj = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const formatted = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return toWesternNumerals(formatted);
};

// Format number with Western Arabic numerals only
export const formatNumber = (num: number, decimals: number = 2): string => {
  return toWesternNumerals(num.toFixed(decimals));
};

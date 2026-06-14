export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Format a number as Pakistani Rupees
 */
export function formatPKR(amount: number | string | undefined): string {
  if (!amount && amount !== 0) return '₨0'
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (isNaN(num)) return '₨0'
  
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Format a date nicely
 */
export function formatDate(date: string | Date | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return new Intl.DateTimeFormat('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

/**
 * Format date and time
 */
export function formatDateTime(date: string | Date | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return new Intl.DateTimeFormat('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Format a time duration in a human-readable way
 */
export function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

/**
 * Generate a status badge color based on status
 */
export function getStatusColor(
  status: string
): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const statusMap: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    // General
    'active': 'success',
    'inactive': 'default',
    'completed': 'success',
    'pending': 'warning',
    'failed': 'destructive',
    'cancelled': 'destructive',
    // Project/Task
    'planning': 'info',
    'in_progress': 'info',
    'review': 'warning',
    'done': 'success',
    'blocked': 'destructive',
    'paused': 'warning',
    // Health
    'good': 'success',
    'at_risk': 'warning',
    'critical': 'destructive',
    // Invoice
    'draft': 'default',
    'sent': 'info',
    'paid': 'success',
    'overdue': 'destructive',
  }

  return statusMap[status.toLowerCase()] || 'default'
}

/**
 * Generate a priority badge color
 */
export function getPriorityColor(
  priority: string
): 'default' | 'info' | 'warning' | 'destructive' {
  const priorityMap: Record<string, 'default' | 'info' | 'warning' | 'destructive'> = {
    'low': 'default',
    'medium': 'info',
    'high': 'warning',
    'critical': 'destructive',
  }

  return priorityMap[priority.toLowerCase()] || 'default'
}

/**
 * Convert an array of objects to CSV
 */
export function arrayToCSV<T extends Record<string, any>>(
  data: T[],
  headers?: (keyof T)[]
): string {
  if (data.length === 0) return ''

  const keys = headers || (Object.keys(data[0]) as (keyof T)[])

  // Create header row
  const headerRow = keys.map(key => `"${String(key)}"`).join(',')

  // Create data rows
  const dataRows = data.map(row =>
    keys
      .map(key => {
        const value = row[key]
        if (value === null || value === undefined) return '""'
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return `"${value}"`
      })
      .join(',')
  )

  return [headerRow, ...dataRows].join('\n')
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    clearTimeout(timeout!)
    timeout = setTimeout(later, wait)
  }
}

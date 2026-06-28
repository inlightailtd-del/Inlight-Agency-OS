import { BaseGrowthModule, type RevenueSimulation, type RevenueScenario } from './types'

export class RevenueSimulator extends BaseGrowthModule {
  async simulate(params: {
    name?: string
    baseLeads?: number
    conversionRate?: number
    avgDealSize?: number
    monthlyGrowth?: number
    monthlyCost?: number
    seasonality?: Record<string, number>
    channels?: { name: string; cost: number; expectedLeads: number; roi: number }[]
  }): Promise<RevenueSimulation> {
    await this.log('revenue_simulation_started', 'Running multi-scenario revenue projection')

    const actualData = await this.collectActualMetrics()
    const baseLeads = params.baseLeads ?? actualData.monthlyLeads ?? 30
    const conversionRate = params.conversionRate ?? actualData.conversionRate ?? 5
    const avgDealSize = params.avgDealSize ?? actualData.avgDealSize ?? 3000
    const monthlyCost = params.monthlyCost ?? 3000

    const assumptions = {
      base_leads: baseLeads,
      conversion_rate: conversionRate,
      avg_deal_size: avgDealSize,
      monthly_growth: params.monthlyGrowth ?? 0.12,
      monthly_cost: monthlyCost,
      seasonality: params.seasonality ?? this.defaultSeasonality(),
    }

    const scenarios: RevenueScenario[] = [
      this.buildScenario('Optimistic', 0.2, assumptions, 1.5),
      this.buildScenario('Realistic', 0.5, assumptions, 1.0),
      this.buildScenario('Conservative', 0.3, assumptions, 0.5),
    ]

    const channelBreakdown = params.channels ?? [
      { channel: 'LinkedIn Outreach', cost: 0, expectedLeads: Math.round(baseLeads * 0.35), roi: 500 },
      { channel: 'Content Marketing', cost: 500, expectedLeads: Math.round(baseLeads * 0.30), roi: 350 },
      { channel: 'Market Intelligence', cost: 200, expectedLeads: Math.round(baseLeads * 0.20), roi: 400 },
      { channel: 'Paid Acquisition', cost: 1000, expectedLeads: Math.round(baseLeads * 0.15), roi: 200 },
    ]

    const breakevenAnalysis = {
      optimistic: scenarios.find((s) => s.name === 'Optimistic')?.breakeven_month ?? null,
      realistic: scenarios.find((s) => s.name === 'Realistic')?.breakeven_month ?? null,
      conservative: scenarios.find((s) => s.name === 'Conservative')?.breakeven_month ?? null,
    }

    const { data, error } = await this.supabase.from('growth_revenue_simulations').insert([{
      user_id: this.userId,
      name: params.name ?? `Revenue Simulation — ${new Date().toLocaleDateString()}`,
      scenarios: JSON.stringify(scenarios),
      assumptions: JSON.stringify(assumptions),
      channel_breakdown: JSON.stringify(channelBreakdown),
      breakeven_analysis: JSON.stringify(breakevenAnalysis),
      status: 'draft',
    }]).select('*').single()

    if (error) throw new Error(`Failed to save simulation: ${error.message}`)

    const totalRealistic = scenarios.find((s) => s.name === 'Realistic')?.total_revenue ?? 0

    await this.storeBrain('revenue_simulation', {
      scenarios: scenarios.map((s) => ({ name: s.name, totalRevenue: s.total_revenue, breakeven: s.breakeven_month })),
      totalRealisticRevenue: totalRealistic,
      breakevenAnalysis,
      assumptions,
    }, ['revenue', 'simulation'])

    await this.log('revenue_simulation_completed',
      `Realistic: $${totalRealistic.toLocaleString()} total | Breakeven: month ${breakevenAnalysis.realistic ?? 'N/A'} | ${scenarios.length} scenarios`)

    return data as RevenueSimulation
  }

  async getLatest(): Promise<RevenueSimulation | null> {
    const { data } = await this.supabase
      .from('growth_revenue_simulations')
      .select('*')
      .eq('user_id', this.userId)
      .order('simulated_at', { ascending: false })
      .limit(1)
      .single()
    return (data ?? null) as RevenueSimulation | null
  }

  private buildScenario(
    name: string,
    probability: number,
    assumptions: RevenueSimulation['assumptions'],
    multiplier: number
  ): RevenueScenario {
    const monthly: { month: number; leads: number; conversions: number; revenue: number; cost: number }[] = []
    let totalRevenue = 0
    let totalCost = 0
    let leads = assumptions.base_leads * multiplier
    let breakevenMonth: number | null = null
    let cumulativeRevenue = 0

    for (let i = 0; i < 12; i++) {
      const month = i + 1
      const seasonFactor = assumptions.seasonality[month.toString()] ?? 1.0
      const growthFactor = 1 + (assumptions.monthly_growth * i)

      const monthlyLeads = Math.round(leads * growthFactor * seasonFactor * multiplier)
      const conversions = Math.max(1, Math.round(monthlyLeads * (assumptions.conversion_rate / 100)))
      const revenue = conversions * assumptions.avg_deal_size
      const cost = assumptions.monthly_cost * (i === 0 ? 2 : 1)

      monthly.push({ month, leads: monthlyLeads, conversions, revenue, cost })
      totalRevenue += revenue
      totalCost += cost
      cumulativeRevenue += revenue - cost

      if (breakevenMonth === null && cumulativeRevenue >= 0) {
        breakevenMonth = month
      }
    }

    const netRevenue = totalRevenue - totalCost

    return {
      name,
      probability,
      monthly,
      total_revenue: totalRevenue,
      total_cost: totalCost,
      net_revenue: netRevenue,
      breakeven_month: breakevenMonth,
    }
  }

  private defaultSeasonality(): Record<string, number> {
    return {
      '1': 0.85, '2': 0.90, '3': 1.05,
      '4': 1.00, '5': 1.10, '6': 0.95,
      '7': 0.80, '8': 0.85, '9': 1.10,
      '10': 1.15, '11': 1.05, '12': 1.20,
    }
  }

  private async collectActualMetrics(): Promise<{
    monthlyLeads: number
    conversionRate: number
    avgDealSize: number
  }> {
    const { data: leads } = await this.supabase
      .from('leads')
      .select('id, status, score, created_at')
      .eq('user_id', this.userId)
      .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())

    const leadList = (leads ?? []) as any[]
    const totalLeads = leadList.length
    const qualified = leadList.filter((l) => l.status === 'qualified' || l.status === 'converted').length
    const converted = leadList.filter((l) => l.status === 'converted').length

    const monthlyLeads = totalLeads > 0 ? Math.round(totalLeads / 3) : 0
    const conversionRate = totalLeads > 0 ? Math.round((qualified / totalLeads) * 100) : 5
    const avgDealSize = converted > 0 ? 5000 : 3000

    return { monthlyLeads, conversionRate, avgDealSize }
  }
}

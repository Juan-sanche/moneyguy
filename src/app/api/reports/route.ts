// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAuth, errorResponse, successResponse } from '../../../../lib/auth-helpers';
import puppeteer from 'puppeteer';
import * as XLSX from 'xlsx';

interface ReportConfig {
  type: 'monthly_summary' | 'budget_analysis' | 'goal_progress' | 'spending_analysis' | 'executive_summary';
  format: 'PDF' | 'EXCEL' | 'JSON';
  period: {
    start: Date;
    end: Date;
  };
  includeCharts: boolean;
  customSections?: string[];
}

// POST /api/reports - Generar reporte automático
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const config: ReportConfig = await request.json();
    
    // Validaciones
    if (!config.type || !config.format) {
      return errorResponse('Tipo y formato de reporte requeridos');
    }

    // Generar datos del reporte
    const reportData = await generateReportData(user.id, config);
    
    // Generar archivo según formato
    let fileBuffer: Buffer;
    let fileName: string;
    let mimeType: string;

    switch (config.format) {
      case 'PDF':
        fileBuffer = await generatePDFReport(reportData, config);
        fileName = `${config.type}_${Date.now()}.pdf`;
        mimeType = 'application/pdf';
        break;
        
      case 'EXCEL':
        fileBuffer = await generateExcelReport(reportData, config);
        fileName = `${config.type}_${Date.now()}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
        
      case 'JSON':
        fileBuffer = Buffer.from(JSON.stringify(reportData, null, 2));
        fileName = `${config.type}_${Date.now()}.json`;
        mimeType = 'application/json';
        break;
        
      default:
        return errorResponse('Formato no soportado');
    }

    // Guardar en base de datos para historial
    const report = await prisma.report.create({
      data: {
        userId: user.id,
        title: generateReportTitle(config),
        type: config.type.toUpperCase() as any,
        period: config.period.start.getMonth() === config.period.end.getMonth() ? 'MONTHLY' : 'CUSTOM',
        format: config.format,
        content: reportData as any,
        fileUrl: `/reports/${fileName}`, // En producción sería S3 o similar
      }
    });

    // Devolver archivo
    return new NextResponse(fileBuffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Report-ID': report.id
      }
    });

  } catch (error) {
    console.error('Error generating report:', error);
    return errorResponse('Failed to generate report', 500);
  }
}

// GET /api/reports - Listar reportes del usuario
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    const reports = await prisma.report.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return successResponse({
      success: true,
      data: reports.map(r => ({
        id: r.id,
        title: r.title,
        type: r.type,
        format: r.format,
        period: r.period,
        createdAt: r.createdAt,
        fileUrl: r.fileUrl
      })),
      message: 'Reports retrieved successfully'
    });

  } catch (error) {
    return errorResponse('Failed to retrieve reports', 500);
  }
}

async function generateReportData(userId: string, config: ReportConfig) {
  // Obtener datos base
  const [transactions, budgets, goals, userProfile] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: config.period.start,
          lte: config.period.end
        }
      },
      include: { category: true },
      orderBy: { date: 'desc' }
    }),
    prisma.budget.findMany({
      where: { userId },
      include: { category: true }
    }),
    prisma.goal.findMany({
      where: { userId }
    }),
    prisma.userProfile.findUnique({
      where: { userId }
    })
  ]);

  // Calcular métricas según tipo de reporte
  const metrics = calculateReportMetrics(transactions, budgets, goals, config);
  
  // Generar análisis específico según tipo
  const analysis = generateAnalysisByType(transactions, budgets, goals, config.type);
  
  // Generar datos para gráficos si se requieren
  const charts = config.includeCharts ? generateChartData(transactions, budgets, goals) : null;

  return {
    metadata: {
      reportType: config.type,
      generatedAt: new Date(),
      period: config.period,
      user: {
        name: `${userProfile?.firstName} ${userProfile?.lastName}`.trim() || 'Usuario',
        email: userProfile?.userId // Simplificado, en realidad necesitarías el email del User
      }
    },
    summary: generateExecutiveSummary(metrics, analysis),
    metrics,
    analysis,
    charts,
    rawData: {
      transactions: transactions.length,
      budgets: budgets.length,
      goals: goals.length
    },
    recommendations: generateRecommendations(metrics, analysis)
  };
}

function calculateReportMetrics(transactions: any[], budgets: any[], goals: any[], _config: ReportConfig) {
  const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
  const netCashFlow = income - expenses;
  const savingsRate = income > 0 ? (netCashFlow / income) * 100 : 0;

  // Métricas de presupuesto
  const budgetMetrics = budgets.map(budget => {
    const budgetExpenses = transactions
      .filter(t => t.type === 'EXPENSE' && 
                  (budget.categoryId ? t.categoryId === budget.categoryId : true))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const utilization = Number(budget.amount) > 0 ? (budgetExpenses / Number(budget.amount)) * 100 : 0;
    
    return {
      category: budget.category?.name || budget.name,
      budgeted: Number(budget.amount),
      spent: budgetExpenses,
      remaining: Number(budget.amount) - budgetExpenses,
      utilization
    };
  });

  // Métricas de metas
  const goalMetrics = goals.map(goal => ({
    title: goal.title,
    target: Number(goal.targetAmount),
    current: Number(goal.currentAmount),
    progress: Number(goal.targetAmount) > 0 ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100 : 0,
    isCompleted: goal.isCompleted,
    deadline: goal.targetDate
  }));

  // Análisis por categorías
  const categoryAnalysis = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc, t) => {
      const category = t.category?.name || 'Sin Categoría';
      acc[category] = (acc[category] || 0) + Number(t.amount);
      return acc;
    }, {} as { [key: string]: number });

  return {
    financial: {
      totalIncome: income,
      totalExpenses: expenses,
      netCashFlow,
      savingsRate,
      transactionCount: transactions.length,
      averageTransactionSize: transactions.length > 0 ? (income + expenses) / transactions.length : 0
    },
    budgets: budgetMetrics,
    goals: goalMetrics,
    categories: Object.entries(categoryAnalysis)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => (b.amount as number) - (a.amount as number))
  };
}

function generateAnalysisByType(transactions: any[], budgets: any[], goals: any[], type: string) {
  switch (type) {
    case 'monthly_summary':
      return generateMonthlySummaryAnalysis(transactions, budgets, goals);
    case 'budget_analysis':
      return generateBudgetAnalysis(transactions, budgets);
    case 'goal_progress':
      return generateGoalProgressAnalysis(goals);
    case 'spending_analysis':
      return generateSpendingAnalysis(transactions);
    case 'executive_summary':
      return generateExecutiveAnalysis(transactions, budgets, goals);
    default:
      return generateMonthlySummaryAnalysis(transactions, budgets, goals);
  }
}

function generateMonthlySummaryAnalysis(transactions: any[], budgets: any[], goals: any[]) {
  return {
    keyHighlights: [
      `Procesadas ${transactions.length} transacciones`,
      `${budgets.length} presupuestos activos`,
      `${goals.length} metas financieras`
    ],
    trends: analyzeTransactionTrends(transactions),
    budgetPerformance: analyzeBudgetPerformance(budgets, transactions),
    goalProgress: analyzeGoalProgress(goals)
  };
}

function generateBudgetAnalysis(transactions: any[], budgets: any[]) {
  return {
    overallCompliance: calculateBudgetCompliance(budgets, transactions),
    categoryBreakdown: budgets.map(budget => ({
      category: budget.category?.name || budget.name,
      performance: analyzeBudgetPerformance([budget], transactions)
    })),
    recommendations: generateBudgetRecommendations(budgets, transactions)
  };
}

function generateGoalProgressAnalysis(goals: any[]) {
  const activeGoals = goals.filter(g => !g.isCompleted);
  const completedGoals = goals.filter(g => g.isCompleted);
  
  return {
    summary: {
      total: goals.length,
      active: activeGoals.length,
      completed: completedGoals.length,
      completionRate: goals.length > 0 ? (completedGoals.length / goals.length) * 100 : 0
    },
    performanceByGoal: goals.map(goal => ({
      title: goal.title,
      progress: Number(goal.targetAmount) > 0 ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100 : 0,
      status: goal.isCompleted ? 'completed' : 'active',
      daysToDeadline: goal.targetDate ? Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
    })),
    recommendations: generateGoalRecommendations(goals)
  };
}

function generateSpendingAnalysis(transactions: any[]) {
  const expenses = transactions.filter(t => t.type === 'EXPENSE');
  
  return {
    patterns: {
      totalSpending: expenses.reduce((sum, t) => sum + Number(t.amount), 0),
      averagePerTransaction: expenses.length > 0 ? expenses.reduce((sum, t) => sum + Number(t.amount), 0) / expenses.length : 0,
      topCategories: analyzeTopSpendingCategories(expenses),
      spendingByDay: analyzeSpendingByDayOfWeek(expenses)
    },
    insights: generateSpendingInsights(expenses),
    anomalies: detectSpendingAnomalies(expenses)
  };
}

function generateExecutiveAnalysis(transactions: any[], budgets: any[], goals: any[]) {
  return {
    executiveSummary: generateHighLevelSummary(transactions, budgets, goals),
    keyMetrics: extractKeyExecutiveMetrics(transactions, budgets, goals),
    strategicRecommendations: generateStrategicRecommendations(transactions, budgets, goals),
    riskAssessment: assessFinancialRisks(transactions, budgets)
  };
}

async function generatePDFReport(reportData: any, config: ReportConfig): Promise<Buffer> {
  const html = generateHTMLReport(reportData, config);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });
    
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function generateHTMLReport(reportData: any, config: ReportConfig): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${reportData.metadata.reportType} - MoneyGuyAI</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
            .header { border-bottom: 3px solid #3B82F6; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #3B82F6; margin: 0; font-size: 28px; }
            .header .meta { color: #666; font-size: 14px; margin-top: 10px; }
            .section { margin-bottom: 30px; }
            .section h2 { color: #1F2937; border-left: 4px solid #3B82F6; padding-left: 15px; }
            .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
            .metric-card { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 15px; }
            .metric-value { font-size: 24px; font-weight: bold; color: #1F2937; }
            .metric-label { color: #6B7280; font-size: 14px; margin-top: 5px; }
            .summary-box { background: #EFF6FF; border: 1px solid #DBEAFE; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .recommendation { background: #F0FDF4; border-left: 4px solid #10B981; padding: 15px; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { text-align: left; padding: 12px; border-bottom: 1px solid #E5E7EB; }
            th { background: #F9FAFB; font-weight: 600; }
            .positive { color: #10B981; }
            .negative { color: #EF4444; }
            .neutral { color: #6B7280; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Reporte Financiero - ${formatReportType(config.type)}</h1>
            <div class="meta">
                Generado: ${new Date().toLocaleDateString('es-ES')} | 
                Usuario: ${reportData.metadata.user.name} |
                Período: ${formatPeriod(reportData.metadata.period)}
            </div>
        </div>

        <div class="section">
            <h2>Resumen Ejecutivo</h2>
            <div class="summary-box">
                ${reportData.summary}
            </div>
        </div>

        <div class="section">
            <h2>Métricas Clave</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value ${reportData.metrics.financial.netCashFlow >= 0 ? 'positive' : 'negative'}">
                        ${formatCurrency(reportData.metrics.financial.netCashFlow)}
                    </div>
                    <div class="metric-label">Flujo de Caja Neto</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">
                        ${reportData.metrics.financial.savingsRate.toFixed(1)}%
                    </div>
                    <div class="metric-label">Tasa de Ahorro</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value positive">
                        ${formatCurrency(reportData.metrics.financial.totalIncome)}
                    </div>
                    <div class="metric-label">Ingresos Totales</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value negative">
                        ${formatCurrency(reportData.metrics.financial.totalExpenses)}
                    </div>
                    <div class="metric-label">Gastos Totales</div>
                </div>
            </div>
        </div>

        ${generateBudgetSection(reportData.metrics.budgets)}
        ${generateGoalsSection(reportData.metrics.goals)}
        ${generateCategoriesSection(reportData.metrics.categories)}
        ${generateRecommendationsSection(reportData.recommendations)}
    </body>
    </html>
  `;
}

async function generateExcelReport(reportData: any, config: ReportConfig): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();

  // Hoja 1: Resumen
  const summaryData = [
    ['Reporte Financiero - ' + formatReportType(config.type)],
    ['Generado:', new Date().toLocaleDateString('es-ES')],
    ['Usuario:', reportData.metadata.user.name],
    [''],
    ['Métricas Financieras'],
    ['Ingresos Totales', reportData.metrics.financial.totalIncome],
    ['Gastos Totales', reportData.metrics.financial.totalExpenses],
    ['Flujo de Caja Neto', reportData.metrics.financial.netCashFlow],
    ['Tasa de Ahorro (%)', reportData.metrics.financial.savingsRate.toFixed(2)],
    ['Número de Transacciones', reportData.metrics.financial.transactionCount]
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  // Hoja 2: Presupuestos
  if (reportData.metrics.budgets.length > 0) {
    const budgetData = [
      ['Categoría', 'Presupuestado', 'Gastado', 'Restante', 'Utilización (%)']
    ];
    
    reportData.metrics.budgets.forEach((budget: any) => {
      budgetData.push([
        budget.category,
        budget.budgeted,
        budget.spent,
        budget.remaining,
        budget.utilization.toFixed(2)
      ]);
    });
    
    const budgetSheet = XLSX.utils.aoa_to_sheet(budgetData);
    XLSX.utils.book_append_sheet(workbook, budgetSheet, 'Presupuestos');
  }

  // Hoja 3: Metas
  if (reportData.metrics.goals.length > 0) {
    const goalsData = [
      ['Meta', 'Objetivo', 'Actual', 'Progreso (%)', 'Estado']
    ];
    
    reportData.metrics.goals.forEach((goal: any) => {
      goalsData.push([
        goal.title,
        goal.target,
        goal.current,
        goal.progress.toFixed(2),
        goal.isCompleted ? 'Completada' : 'Activa'
      ]);
    });
    
    const goalsSheet = XLSX.utils.aoa_to_sheet(goalsData);
    XLSX.utils.book_append_sheet(workbook, goalsSheet, 'Metas');
  }

  // Hoja 4: Gastos por Categoría
  const categoryData = [
    ['Categoría', 'Monto']
  ];
  
  reportData.metrics.categories.forEach((category: any) => {
    categoryData.push([category.category, category.amount]);
  });
  
  const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
  XLSX.utils.book_append_sheet(workbook, categorySheet, 'Categorías');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Funciones auxiliares para formateo
function formatReportType(type: string): string {
  const types: { [key: string]: string } = {
    'monthly_summary': 'Resumen Mensual',
    'budget_analysis': 'Análisis de Presupuestos',
    'goal_progress': 'Progreso de Metas',
    'spending_analysis': 'Análisis de Gastos',
    'executive_summary': 'Resumen Ejecutivo'
  };
  return types[type] || type;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

function formatPeriod(period: any): string {
  const start = new Date(period.start).toLocaleDateString('es-ES');
  const end = new Date(period.end).toLocaleDateString('es-ES');
  return `${start} - ${end}`;
}

function generateReportTitle(config: ReportConfig): string {
  const typeNames: { [key: string]: string } = {
    'monthly_summary': 'Resumen Mensual',
    'budget_analysis': 'Análisis de Presupuestos',
    'goal_progress': 'Progreso de Metas',
    'spending_analysis': 'Análisis de Gastos',
    'executive_summary': 'Resumen Ejecutivo'
  };
  
  const month = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return `${typeNames[config.type]} - ${month}`;
}

function generateBudgetSection(budgets: any[]): string {
  if (!budgets.length) return '';
  
  let rows = '';
  budgets.forEach(budget => {
    const statusClass = budget.utilization > 100 ? 'negative' : 
                       budget.utilization > 80 ? 'neutral' : 'positive';
    
    rows += `
      <tr>
        <td>${budget.category}</td>
        <td>${formatCurrency(budget.budgeted)}</td>
        <td>${formatCurrency(budget.spent)}</td>
        <td class="${statusClass}">${budget.utilization.toFixed(1)}%</td>
      </tr>
    `;
  });

  return `
    <div class="section">
      <h2>Estado de Presupuestos</h2>
      <table>
        <thead>
          <tr><th>Categoría</th><th>Presupuestado</th><th>Gastado</th><th>Utilización</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function generateGoalsSection(goals: any[]): string {
  if (!goals.length) return '';
  
  let rows = '';
  goals.forEach(goal => {
    const statusClass = goal.isCompleted ? 'positive' : 
                       goal.progress > 70 ? 'positive' : 
                       goal.progress > 40 ? 'neutral' : 'negative';
    
    rows += `
      <tr>
        <td>${goal.title}</td>
        <td>${formatCurrency(goal.target)}</td>
        <td>${formatCurrency(goal.current)}</td>
        <td class="${statusClass}">${goal.progress.toFixed(1)}%</td>
      </tr>
    `;
  });

  return `
    <div class="section">
      <h2>Progreso de Metas</h2>
      <table>
        <thead>
          <tr><th>Meta</th><th>Objetivo</th><th>Actual</th><th>Progreso</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function generateCategoriesSection(categories: any[]): string {
  const top5 = categories.slice(0, 5);
  
  let rows = '';
  top5.forEach(category => {
    rows += `
      <tr>
        <td>${category.category}</td>
        <td class="negative">${formatCurrency(category.amount)}</td>
      </tr>
    `;
  });

  return `
    <div class="section">
      <h2>Top 5 Categorías de Gasto</h2>
      <table>
        <thead>
          <tr><th>Categoría</th><th>Monto</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function generateRecommendationsSection(recommendations: any[]): string {
  if (!recommendations?.length) return '';
  
  let recHtml = '';
  recommendations.forEach(rec => {
    recHtml += `<div class="recommendation">${rec}</div>`;
  });

  return `
    <div class="section">
      <h2>Recomendaciones</h2>
      ${recHtml}
    </div>
  `;
}

// Funciones auxiliares de análisis (simplificadas para brevedad)
function analyzeTransactionTrends(_transactions: any[]) {
  return ['Tendencia de gastos estable', 'Ingresos regulares'];
}

function analyzeBudgetPerformance(_budgets: any[], _transactions: any[]) {
  return 'Performance general positivo';
}

function analyzeGoalProgress(_goals: any[]) {
  return 'Progreso satisfactorio en metas principales';
}

function calculateBudgetCompliance(_budgets: any[], _transactions: any[]) {
  return 85; // Simplificado
}

function generateBudgetRecommendations(_budgets: any[], _transactions: any[]) {
  return ['Revisar presupuesto de categorías con alta utilización'];
}

function generateGoalRecommendations(_goals: any[]) {
  return ['Aumentar contribuciones mensuales a metas prioritarias'];
}

function analyzeTopSpendingCategories(_expenses: any[]) {
  return _expenses.slice(0, 3).map((e: any) => e.category?.name || 'Sin categoría');
}

function analyzeSpendingByDayOfWeek(_expenses: any[]) {
  return 'Mayor actividad los fines de semana';
}

function generateSpendingInsights(_expenses: any[]) {
  return ['Patrón de gasto consistente', 'Oportunidades de ahorro identificadas'];
}

function detectSpendingAnomalies(_expenses: any[]) {
  return ['Gasto inusual detectado el 15 del mes'];
}

function generateHighLevelSummary(_transactions: any[], _budgets: any[], _goals: any[]) {
  return 'Situación financiera estable con oportunidades de mejora identificadas';
}

function extractKeyExecutiveMetrics(_transactions: any[], _budgets: any[], _goals: any[]) {
  return {
    cashFlowHealth: 'Saludable',
    budgetAdherence: 'Buena',
    goalTrajectory: 'En camino'
  };
}

function generateStrategicRecommendations(_transactions: any[], _budgets: any[], _goals: any[]) {
  return [
    'Optimizar asignación presupuestaria',
    'Acelerar progreso en metas de alta prioridad',
    'Diversificar fuentes de ingresos'
  ];
}

function assessFinancialRisks(_transactions: any[], _budgets: any[]) {
  return {
    level: 'Bajo',
    factors: ['Dependencia de ingresos únicos', 'Falta de fondo de emergencia']
  };
}

function generateExecutiveSummary(metrics: any, _analysis: any) {
  return `Análisis del período muestra un flujo de caja ${metrics.financial.netCashFlow >= 0 ? 'positivo' : 'negativo'} 
          de ${formatCurrency(metrics.financial.netCashFlow)} con una tasa de ahorro del ${metrics.financial.savingsRate.toFixed(1)}%. 
          Se procesaron ${metrics.financial.transactionCount} transacciones durante el período analizado.`;
}

function generateRecommendations(metrics: any, _analysis: any) {
  const recommendations = [];
  
  if (metrics.financial.savingsRate < 10) {
    recommendations.push('Considera aumentar tu tasa de ahorro al 20% de tus ingresos');
  }
  
  if (metrics.budgets.some((b: any) => b.utilization > 100)) {
    recommendations.push('Revisa los presupuestos que han excedido sus límites');
  }
  
  if (metrics.goals.some((g: any) => g.progress < 50 && !g.isCompleted)) {
    recommendations.push('Acelera el progreso en metas con bajo avance');
  }
  
  return recommendations;
}

function generateChartData(_transactions: any[], _budgets: any[], _goals: any[]) {
  return {
    monthlyTrend: 'Data for monthly spending trend',
    categoryBreakdown: 'Data for category distribution',
    budgetProgress: 'Data for budget progress'
  };
}
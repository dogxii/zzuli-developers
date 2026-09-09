#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
)
const OUTPUT_PATH = process.env.SITE_STATS_OUTPUT_PATH
	? path.resolve(process.env.SITE_STATS_OUTPUT_PATH)
	: path.join(ROOT_DIR, 'data', 'site-stats.json')
const ENDPOINT =
	process.env.CLOUDFLARE_GRAPHQL_ENDPOINT ??
	'https://api.cloudflare.com/client/v4/graphql'
const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? ''
const ACCOUNT_TAG = (process.env.CLOUDFLARE_ACCOUNT_TAG ?? '').trim()
const SITE_TAG = (process.env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG ?? '').trim()
const HOSTNAME = (process.env.SITE_STATS_HOSTNAME ?? 'zzuli.dev').trim()
const DAYS = positiveInteger(process.env.SITE_STATS_DAYS, 30)

function positiveInteger(value, fallback) {
	const parsed = Number(value)
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function toDateKey(date) {
	return date.toISOString().slice(0, 10)
}

function toFiniteNumber(value) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function sumNumbers(values, readValue) {
	return values.reduce((total, value) => total + (readValue(value) ?? 0), 0)
}

async function cloudflareGraphql(query, variables) {
	const response = await fetch(ENDPOINT, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${TOKEN}`,
			'content-type': 'application/json',
			'user-agent': 'ZZULI.dev-site-stats/1.0',
		},
		body: JSON.stringify({ query, variables }),
	})

	const payload = await response.json().catch(() => null)
	if (!response.ok) {
		throw new Error(`Cloudflare GraphQL HTTP ${response.status}`)
	}
	if (payload?.errors?.length) {
		throw new Error(payload.errors.map((error) => error.message).join('; '))
	}

	return payload.data
}

async function fetchWebAnalytics({ since, until }) {
	const data = await cloudflareGraphql(
		`query SiteWebAnalytics($accountTag: string!, $siteTag: string!, $since: Time!, $until: Time!) {
			viewer {
				accounts(filter: { accountTag: $accountTag }) {
					rumPageloadEventsAdaptiveGroups(
						limit: 100,
						filter: {
							datetime_geq: $since,
							datetime_lt: $until,
							siteTag: $siteTag,
							bot: 0
						}
					) {
						count
						sum {
							visits
						}
						dimensions {
							date
						}
					}
				}
			}
		}`,
		{ accountTag: ACCOUNT_TAG, siteTag: SITE_TAG, since, until },
	)
	const accounts = data?.viewer?.accounts
	if (!Array.isArray(accounts) || accounts.length !== 1) {
		throw new Error(
			'未返回 Cloudflare Account 数据，请检查 CLOUDFLARE_ACCOUNT_TAG。',
		)
	}

	const groups = accounts[0]?.rumPageloadEventsAdaptiveGroups
	if (!Array.isArray(groups)) {
		throw new Error('Cloudflare Web Analytics 响应格式无效。')
	}

	return {
		pageViews: sumNumbers(groups, (group) => toFiniteNumber(group.count)),
		visits: sumNumbers(groups, (group) => toFiniteNumber(group.sum?.visits)),
	}
}

async function collect() {
	const missing = [
		!TOKEN ? 'CLOUDFLARE_API_TOKEN' : null,
		!ACCOUNT_TAG ? 'CLOUDFLARE_ACCOUNT_TAG' : null,
		!SITE_TAG ? 'CLOUDFLARE_WEB_ANALYTICS_SITE_TAG' : null,
	].filter(Boolean)
	if (missing.length > 0) {
		throw new Error(
			`缺少 ${missing.join('、')}，无法采集 Cloudflare Web Analytics。`,
		)
	}

	const now = new Date()
	const until = now.toISOString()
	const since = new Date(
		now.getTime() - DAYS * 24 * 60 * 60 * 1000,
	).toISOString()
	const totals = await fetchWebAnalytics({ since, until })
	const output = {
		schemaVersion: 2,
		generatedAt: now.toISOString(),
		range: {
			from: toDateKey(new Date(since)),
			to: toDateKey(now),
			days: DAYS,
		},
		hostname: HOSTNAME || null,
		visits: totals.visits,
		pageViews: totals.pageViews,
		excludeBots: true,
		source: 'cloudflare-web-analytics:rumPageloadEventsAdaptiveGroups',
		available: true,
	}

	await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, '\t')}\n`)
	console.log(
		`已更新 Web Analytics：近 ${DAYS} 天 ${totals.visits} 次访问，${totals.pageViews} 次页面浏览。`,
	)
}

collect().catch((error) => {
	console.error(error)
	process.exit(1)
})

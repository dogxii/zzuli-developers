import fs from 'node:fs'
import path from 'node:path'
import type { SearchItem } from '$lib/search'

export type Project = {
	name: string
	url: string
	description: string
	author: {
		name: string
		github: string | null
		url: string | null
		avatar: string | null
	}
	languages: Array<{
		name: string
		color: string
	}>
	submittedAt: string | null
}

export type FriendLink = {
	name: string
	url: string
	description: string
	avatar: string | null
}

export type Alumni = {
	id: string
	nickname: string
	joinedAt: string | null
	github: {
		username: string
		url: string
	}
	blog: {
		name: string
		url: string
	} | null
	avatar: string
	profilePath: string
}

export type BlogPost = {
	id?: string
	title: string
	url: string
	sourceName: string
	sourceSiteName?: string
	sourceUrl: string
	publishedAt: string | null
	fetchedAt: string
	discoveredBy: 'feed' | 'html' | 'sitemap' | string
}

export type BlogSource = {
	name: string
	siteName?: string
	url: string
	status: string
	strategy: string
	itemCount: number
	error?: string
}

export type GitHubActivityDay = {
	date: string
	count: number
	color: string
}

export type GitHubActivityRepository = {
	name: string
	nameWithOwner: string
	url: string
	pushedAt: string | null
	stars: number
	language: {
		name: string
		color: string
	} | null
}

export type GitHubActivityMember = {
	github: string
	name: string | null
	url: string
	avatar: string
	latestDayContributions: number
	recentContributions: number
	totalContributions: number
	calendar: GitHubActivityDay[]
	recentRepositories: GitHubActivityRepository[]
}

export type GitHubActivityData = {
	generatedAt: string | null
	range: {
		from: string | null
		to: string | null
		recentDays: number
	}
	members: GitHubActivityMember[]
}

export type SiteStats = {
	schemaVersion: number
	generatedAt: string | null
	range: {
		from: string | null
		to: string | null
		days: number
	}
	hostname: string | null
	visits: number | null
	pageViews: number | null
	excludeBots: boolean
	source: string | null
	available: boolean
}

type BlogPostsFile = {
	crawl?: {
		minPostDate?: string | null
		recentYears?: number | null
	}
	generatedAt?: string
	posts?: BlogPost[]
	sources?: BlogSource[]
}

type GitHubActivityFile = Partial<GitHubActivityData>
type SiteStatsFile = Partial<SiteStats>
type RawGitHubActivityCalendar =
	| GitHubActivityDay[]
	| {
			start?: string | null
			counts?: number[]
			colors?: string[]
	  }
type RawGitHubActivityMember = Omit<
	GitHubActivityMember,
	'calendar' | 'latestDayContributions'
> & {
	calendar?: RawGitHubActivityCalendar
	latestDayContributions?: number
	todayContributions?: number
}

type LoadSiteDataOptions = {
	postLimit?: number
}

const DEFAULT_BLOG_CRAWL_YEARS = 2
const DEFAULT_GITHUB_ACTIVITY_DAYS = 7
const DEFAULT_SITE_STATS_DAYS = 30

type AlumniRecord = {
	nickname?: string
	github?: string
	joinedAt?: string | null
	blog?: {
		name?: string
		url?: string
	} | null
}

type ProjectRecord = {
	name?: string
	url?: string
	description?: string
	author?:
		| {
				name?: string
				github?: string
		  }
		| string
	languages?: string[]
	submittedAt?: string
}

type FriendLinkRecord = {
	name?: string
	url?: string
	description?: string
	avatar?: string
}

const LANGUAGE_COLORS: Record<string, string> = {
	'C++': '#f34b7d',
	C: '#555555',
	CSS: '#563d7c',
	Go: '#00add8',
	HTML: '#e34c26',
	Java: '#b07219',
	JavaScript: '#f1e05a',
	Other: '#8b949e',
	Python: '#3572a5',
	Rust: '#dea584',
	Shell: '#89e051',
	Svelte: '#ff3e00',
	TypeScript: '#3178c6',
	Vue: '#41b883',
}
const KNOWN_LANGUAGE_NAMES = new Map(
	Object.keys(LANGUAGE_COLORS).map((language) => [
		language.toLowerCase(),
		language,
	]),
)

function findRepoFile(relativePath: string): string | null {
	const candidates = [
		path.resolve(process.cwd(), '..', relativePath),
		path.resolve(process.cwd(), relativePath),
	]

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate
		}
	}

	return null
}

function normalizeGitHubUsername(value: string): string {
	return value
		.trim()
		.replace(/^@/, '')
		.replace(/^https?:\/\/github\.com\//i, '')
		.replace(/[/?#].*$/, '')
}

function inferGitHubOwner(url: string): string {
	const match = url.match(/^https?:\/\/github\.com\/([^/?#]+)/i)
	return match ? normalizeGitHubUsername(match[1]) : ''
}

function toProjectAuthor(
	record: ProjectRecord,
	projectUrl: string,
): Project['author'] {
	const authorName =
		typeof record.author === 'string'
			? record.author.trim()
			: record.author?.name?.trim()
	const github =
		typeof record.author === 'object'
			? normalizeGitHubUsername(record.author.github ?? '')
			: inferGitHubOwner(projectUrl)
	const fallbackGithub = github || inferGitHubOwner(projectUrl)
	const displayName = authorName || fallbackGithub || '未知作者'

	return {
		name: displayName,
		github: fallbackGithub || null,
		url: fallbackGithub ? `https://github.com/${fallbackGithub}` : null,
		avatar: fallbackGithub ? `https://github.com/${fallbackGithub}.png` : null,
	}
}

function toProjectLanguages(languages: string[] | undefined) {
	const names =
		Array.isArray(languages) && languages.length > 0 ? languages : ['Other']

	const normalized = names
		.map((language) => language.trim())
		.filter(Boolean)
		.map(
			(language) =>
				KNOWN_LANGUAGE_NAMES.get(language.toLowerCase()) ?? language,
		)
	const displayLanguages =
		normalized.length > 0 ? Array.from(new Set(normalized)) : ['Other']

	return displayLanguages.map((language) => ({
		name: language,
		color: LANGUAGE_COLORS[language] ?? LANGUAGE_COLORS.Other,
	}))
}

function toAlumni(record: AlumniRecord): Alumni | null {
	const nickname = record.nickname?.trim()
	const username = normalizeGitHubUsername(record.github ?? '')

	if (!nickname || !username) {
		return null
	}

	return {
		id: username.toLowerCase(),
		nickname,
		joinedAt: record.joinedAt ?? null,
		github: {
			username,
			url: `https://github.com/${username}`,
		},
		blog: record.blog?.url
			? {
					name: record.blog.name?.trim() || nickname,
					url: record.blog.url,
				}
			: null,
		avatar: `https://github.com/${username}.png`,
		profilePath: `/members/${username.toLowerCase()}`,
	}
}

function readAlumni(): Alumni[] {
	const alumniPath = findRepoFile('data/alumni.json')
	if (!alumniPath) {
		console.warn('Warning: data/alumni.json not found')
		return []
	}

	try {
		const data = JSON.parse(fs.readFileSync(alumniPath, 'utf-8'))
		if (!Array.isArray(data)) {
			console.error('Error reading data/alumni.json: expected an array')
			return []
		}

		return data
			.map(toAlumni)
			.filter((person): person is Alumni => person !== null)
	} catch (error) {
		console.error('Error reading data/alumni.json:', error)
		return []
	}
}

function toProject(record: ProjectRecord): Project | null {
	const name = record.name?.trim()
	const url = record.url?.trim()
	const description = record.description?.trim()

	if (!name || !url || !description) {
		return null
	}

	return {
		name,
		url,
		description,
		author: toProjectAuthor(record, url),
		languages: toProjectLanguages(record.languages),
		submittedAt: record.submittedAt?.trim() || null,
	}
}

function readProjects(): Project[] {
	const projectsPath = findRepoFile('data/projects.json')
	if (!projectsPath) {
		console.warn('Warning: data/projects.json not found')
		return []
	}

	try {
		const data = JSON.parse(fs.readFileSync(projectsPath, 'utf-8'))
		if (!Array.isArray(data)) {
			console.error('Error reading data/projects.json: expected an array')
			return []
		}

		return data
			.map(toProject)
			.filter((project): project is Project => project !== null)
			.sort((a, b) => {
				const timeA = a.submittedAt ? Date.parse(a.submittedAt) : 0
				const timeB = b.submittedAt ? Date.parse(b.submittedAt) : 0
				return timeB - timeA
			})
	} catch (error) {
		console.error('Error reading data/projects.json:', error)
		return []
	}
}

function toFriendLink(record: FriendLinkRecord): FriendLink | null {
	const name = record.name?.trim()
	const url = record.url?.trim()

	if (!name || !url) {
		return null
	}

	return {
		name,
		url,
		description: record.description?.trim() ?? '',
		avatar: record.avatar?.trim() || null,
	}
}

function readFriendLinks(): FriendLink[] {
	const linksPath = findRepoFile('data/friend-links.json')
	if (!linksPath) {
		return []
	}

	try {
		const data = JSON.parse(fs.readFileSync(linksPath, 'utf-8'))
		if (!Array.isArray(data)) {
			console.error('Error reading data/friend-links.json: expected an array')
			return []
		}

		return data
			.map(toFriendLink)
			.filter((link): link is FriendLink => link !== null)
	} catch (error) {
		console.error('Error reading data/friend-links.json:', error)
		return []
	}
}

function readBlogPosts(): {
	crawlWindowLabel: string
	generatedAt: string | null
	posts: BlogPost[]
	sources: BlogSource[]
} {
	const postsPath = findRepoFile('data/blog-posts.json')

	if (!postsPath) {
		return {
			crawlWindowLabel: `最近 ${DEFAULT_BLOG_CRAWL_YEARS} 年`,
			generatedAt: null,
			posts: [],
			sources: [],
		}
	}

	try {
		const parsed = JSON.parse(
			fs.readFileSync(postsPath, 'utf-8'),
		) as BlogPostsFile
		return {
			crawlWindowLabel: formatCrawlWindowLabel(parsed.crawl),
			generatedAt: parsed.generatedAt ?? null,
			posts: parsed.posts ?? [],
			sources: parsed.sources ?? [],
		}
	} catch (error) {
		console.error('Error reading data/blog-posts.json:', error)
		return {
			crawlWindowLabel: `最近 ${DEFAULT_BLOG_CRAWL_YEARS} 年`,
			generatedAt: null,
			posts: [],
			sources: [],
		}
	}
}

function formatCrawlWindowLabel(crawl: BlogPostsFile['crawl']): string {
	if (crawl?.recentYears && crawl.recentYears > 0) {
		return `最近 ${crawl.recentYears} 年`
	}

	if (crawl?.minPostDate) {
		return `${crawl.minPostDate.replaceAll('-', '.')} 以来`
	}

	return `最近 ${DEFAULT_BLOG_CRAWL_YEARS} 年`
}

function emptyGitHubActivity(): GitHubActivityData {
	return {
		generatedAt: null,
		range: {
			from: null,
			to: null,
			recentDays: DEFAULT_GITHUB_ACTIVITY_DAYS,
		},
		members: [],
	}
}

function addDaysToDateKey(dateKey: string, days: number) {
	const date = new Date(`${dateKey}T00:00:00Z`)
	if (Number.isNaN(date.getTime())) return null

	date.setUTCDate(date.getUTCDate() + days)
	return date.toISOString().slice(0, 10)
}

function getContributionColor(count: number) {
	if (count <= 0) return '#ebedf0'
	if (count < 3) return '#9be9a8'
	if (count < 6) return '#40c463'
	if (count < 10) return '#30a14e'
	return '#216e39'
}

function normalizeGitHubActivityCalendar(
	calendar: RawGitHubActivityCalendar | undefined,
): GitHubActivityDay[] {
	if (Array.isArray(calendar)) {
		return calendar
			.map((day) => ({
				date: day.date,
				count: day.count,
				color: day.color,
			}))
			.filter((day) => day.date)
	}

	if (!calendar?.start || !Array.isArray(calendar.counts)) {
		return []
	}

	return calendar.counts
		.map((count, index) => {
			const date = addDaysToDateKey(calendar.start as string, index)
			return date
				? {
						date,
						count,
						color: calendar.colors?.[index] ?? getContributionColor(count),
					}
				: null
		})
		.filter((day): day is GitHubActivityDay => day !== null)
}

function normalizeGitHubActivityMember(
	member: RawGitHubActivityMember,
): GitHubActivityMember {
	const {
		calendar,
		latestDayContributions,
		todayContributions,
		...normalizedMember
	} = member

	return {
		...normalizedMember,
		latestDayContributions: latestDayContributions ?? todayContributions ?? 0,
		calendar: normalizeGitHubActivityCalendar(calendar),
	}
}

function readGitHubActivity(): GitHubActivityData {
	const activityPath = findRepoFile('data/github-activity.json')
	if (!activityPath) {
		return emptyGitHubActivity()
	}

	try {
		const parsed = JSON.parse(
			fs.readFileSync(activityPath, 'utf-8'),
		) as GitHubActivityFile
		return {
			generatedAt: parsed.generatedAt ?? null,
			range: {
				from: parsed.range?.from ?? null,
				to: parsed.range?.to ?? null,
				recentDays:
					typeof parsed.range?.recentDays === 'number'
						? parsed.range.recentDays
						: DEFAULT_GITHUB_ACTIVITY_DAYS,
			},
			members: Array.isArray(parsed.members)
				? (parsed.members as RawGitHubActivityMember[]).map(
						normalizeGitHubActivityMember,
					)
				: [],
		}
	} catch (error) {
		console.error('Error reading data/github-activity.json:', error)
		return emptyGitHubActivity()
	}
}

function emptySiteStats(): SiteStats {
	return {
		schemaVersion: 2,
		generatedAt: null,
		range: {
			from: null,
			to: null,
			days: DEFAULT_SITE_STATS_DAYS,
		},
		hostname: 'zzuli.dev',
		visits: null,
		pageViews: null,
		excludeBots: false,
		source: null,
		available: false,
	}
}

function readSiteStats(): SiteStats {
	const statsPath = findRepoFile('data/site-stats.json')
	if (!statsPath) {
		return emptySiteStats()
	}

	try {
		const parsed = JSON.parse(
			fs.readFileSync(statsPath, 'utf-8'),
		) as SiteStatsFile
		if (parsed.schemaVersion !== 2) {
			return emptySiteStats()
		}

		return {
			schemaVersion: 2,
			generatedAt: parsed.generatedAt ?? null,
			range: {
				from: parsed.range?.from ?? null,
				to: parsed.range?.to ?? null,
				days:
					typeof parsed.range?.days === 'number'
						? parsed.range.days
						: DEFAULT_SITE_STATS_DAYS,
			},
			hostname: parsed.hostname ?? 'zzuli.dev',
			visits: parsed.visits ?? null,
			pageViews: parsed.pageViews ?? null,
			excludeBots: parsed.excludeBots ?? false,
			source: parsed.source ?? null,
			available: parsed.available ?? false,
		}
	} catch (error) {
		console.error('Error reading data/site-stats.json:', error)
		return emptySiteStats()
	}
}

function buildSearchIndex({
	alumni,
	blogPosts,
	blogSources,
	projects,
}: {
	alumni: Alumni[]
	blogPosts: BlogPost[]
	blogSources: BlogSource[]
	projects: Project[]
}): SearchItem[] {
	const items: SearchItem[] = []
	const seen = new Set<string>()
	const alumniByName = new Map(
		alumni.map((person) => [person.nickname, person]),
	)
	const addItem = (item: SearchItem) => {
		const key = `${item.type}:${item.href}`
		if (seen.has(key)) return

		seen.add(key)
		items.push(item)
	}

	for (const person of alumni) {
		addItem({
			type: 'member',
			title: person.nickname,
			subtitle: `@${person.github.username}`,
			href: person.profilePath,
			external: false,
			avatarUrl: person.avatar,
			keywords: [
				person.nickname,
				person.github.username,
				person.github.url,
				person.blog?.name,
				person.blog?.url,
			]
				.filter(Boolean)
				.join(' '),
		})
	}

	for (const project of projects) {
		addItem({
			type: 'project',
			title: project.name,
			subtitle: project.author.github
				? `@${project.author.github}`
				: project.author.name,
			href: project.url,
			external: true,
			avatarUrl: project.author.avatar,
			keywords: [
				project.name,
				project.description,
				project.author.name,
				project.author.github,
				project.url,
				...project.languages.map((language) => language.name),
			]
				.filter(Boolean)
				.join(' '),
		})
	}

	for (const post of blogPosts) {
		addItem({
			type: 'article',
			title: post.title,
			subtitle: post.sourceName,
			href: post.url,
			external: true,
			avatarUrl: alumniByName.get(post.sourceName)?.avatar ?? null,
			keywords: [
				post.title,
				post.sourceName,
				post.sourceSiteName,
				post.sourceUrl,
				post.publishedAt,
			]
				.filter(Boolean)
				.join(' '),
		})
	}

	for (const source of blogSources) {
		addItem({
			type: 'source',
			title: source.siteName ?? source.name,
			subtitle: source.name,
			href: source.url,
			external: true,
			avatarUrl: alumniByName.get(source.name)?.avatar ?? null,
			keywords: [
				source.name,
				source.siteName,
				source.url,
				source.status,
				source.strategy,
			]
				.filter(Boolean)
				.join(' '),
		})
	}

	return items
}

export function loadSiteData(options: LoadSiteDataOptions = {}) {
	try {
		const projects = readProjects()
		const alumni = readAlumni()
		const friendLinks = readFriendLinks()
		const blogPosts = readBlogPosts()
		const githubActivity = readGitHubActivity()
		const siteStats = readSiteStats()
		const searchIndex = buildSearchIndex({
			alumni,
			blogPosts: blogPosts.posts,
			blogSources: blogPosts.sources,
			projects,
		})
		const posts =
			typeof options.postLimit === 'number'
				? blogPosts.posts.slice(0, options.postLimit)
				: blogPosts.posts

		return {
			projects,
			alumni,
			friendLinks,
			blogPosts: posts,
			blogPostCount: blogPosts.posts.length,
			blogCrawlWindowLabel: blogPosts.crawlWindowLabel,
			blogPostsGeneratedAt: blogPosts.generatedAt,
			blogSources: blogPosts.sources,
			githubActivity,
			searchIndex,
			siteStats,
		}
	} catch (error) {
		console.error('Error reading site data:', error)
		return {
			projects: [],
			alumni: [],
			friendLinks: [],
			blogPosts: [],
			blogPostCount: 0,
			blogCrawlWindowLabel: `最近 ${DEFAULT_BLOG_CRAWL_YEARS} 年`,
			blogPostsGeneratedAt: null,
			blogSources: [],
			githubActivity: emptyGitHubActivity(),
			searchIndex: [],
			siteStats: emptySiteStats(),
		}
	}
}

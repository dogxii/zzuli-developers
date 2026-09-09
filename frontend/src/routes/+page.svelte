<script lang="ts">
import { onMount } from 'svelte'
import {
	ACTIVITY_PERIODS,
	type ActivityPeriodKey,
	getActivityMemberView,
	getActivityPeriod,
	getContributionCount,
	getNextActivityPeriodKey,
	isActivityPeriodKey,
} from '$lib/activity'
import Seo from '$lib/components/Seo.svelte'
import SiteHeader from '$lib/components/SiteHeader.svelte'
import { formatGeneratedAt, formatMetric, formatPostDate } from '$lib/format'
import { absoluteUrl, compactJsonLd, siteJsonLd } from '$lib/seo'
import { REPOSITORY_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from '$lib/site'
import {
	getSavedThemeMode,
	type ResolvedTheme,
	resolveThemeMode,
	saveThemeMode,
	type ThemeMode,
	watchSystemTheme,
} from '$lib/theme'
import type { PageData } from './$types'

const HOME_POST_LIMIT = 20
const HOME_STRUCTURED_POST_LIMIT = 10
const HOME_PROJECT_LIMIT = 5
const HOME_ACTIVITY_STORAGE_KEY = 'zzuli-home-activity-period'
const READ_POSTS_STORAGE_KEY = 'zzuli-read-posts'
const READ_POST_TTL_MS = 180 * 24 * 60 * 60 * 1000
const SIDEBAR_MEMBER_COLUMNS = 7
const SIDEBAR_MEMBER_ROWS = 4
const SIDEBAR_MEMBER_SLOTS = SIDEBAR_MEMBER_COLUMNS * SIDEBAR_MEMBER_ROWS
const COPYRIGHT_YEAR = new Date().getFullYear()
const SUBMIT_ALUMNI_URL =
	'https://github.com/dogxii/ZZULI.dev/issues/new?template=submit-alumni.yml'
const SUBMIT_PROJECT_URL =
	'https://github.com/dogxii/ZZULI.dev/issues/new?template=submit-project.yml'
const CONTACT_EMAIL = 'hi@dogxi.me'
const HOME_TITLE = `${SITE_NAME} | ${SITE_TAGLINE}`
const HOME_DESCRIPTION = SITE_DESCRIPTION
type SiteStatsIcon = 'views' | 'visitors'

let { data }: { data: PageData } = $props()

let themeMode = $state<ThemeMode>('auto')
let resolvedTheme = $state<ResolvedTheme>('light')
let searchTerm = $state('')
let memberSample = $state<PageData['alumni']>([])
let memberOrder = $state<PageData['alumni']>([])
let projectSample = $state<PageData['projects']>([])
let sourcesExpanded = $state(false)
let selectedHomeActivityPeriod = $state<ActivityPeriodKey>('7d')
let readPostUrls = $state<Set<string>>(new Set())

let totalAlumni = $derived(data.alumni.length)
let totalProjects = $derived(data.projects.length)
let totalBlogs = $derived(
	data.alumni.filter((person) => person.blog?.url).length,
)
let sourceHelpText = $derived(`爬取${data.blogCrawlWindowLabel}的文章`)
let normalizedSearch = $derived(searchTerm.trim().toLowerCase())
let orderedAlumni = $derived(memberOrder.length > 0 ? memberOrder : data.alumni)
let filteredAlumni = $derived(
	orderedAlumni.filter((person) => {
		if (!normalizedSearch) return true

		return [
			person.nickname,
			person.github.username,
			person.github.url,
			person.blog?.name,
			person.blog?.url,
		]
			.filter(Boolean)
			.some((value) => value?.toLowerCase().includes(normalizedSearch))
	}),
)
let homePosts = $derived(data.blogPosts)
let homeJsonLd = $derived([
	...siteJsonLd(),
	compactJsonLd({
		'@type': 'CollectionPage',
		name: HOME_TITLE,
		description: HOME_DESCRIPTION,
		url: absoluteUrl('/'),
		mainEntity: compactJsonLd({
			'@type': 'ItemList',
			itemListElement: homePosts
				.slice(0, HOME_STRUCTURED_POST_LIMIT)
				.map((post, index) =>
					compactJsonLd({
						'@type': 'ListItem',
						position: index + 1,
						url: post.url,
						item: compactJsonLd({
							'@type': 'CreativeWork',
							name: post.title,
							url: post.url,
							author: compactJsonLd({
								'@type': 'Person',
								name: post.sourceName,
							}),
							datePublished: post.publishedAt,
						}),
					}),
				),
		}),
	}),
])
let hasMorePosts = $derived(data.blogPostCount > HOME_POST_LIMIT)
let featuredProjects = $derived(
	projectSample.length > 0
		? projectSample
		: data.projects.slice(0, HOME_PROJECT_LIMIT),
)
let avatarMembers = $derived(data.alumni.filter((person) => person.avatar))
let sidebarMemberLimit = $derived(
	avatarMembers.length > SIDEBAR_MEMBER_SLOTS
		? SIDEBAR_MEMBER_SLOTS - 1
		: SIDEBAR_MEMBER_SLOTS,
)
let featuredMembers = $derived(
	memberSample.length > 0
		? memberSample
		: avatarMembers.slice(0, sidebarMemberLimit),
)
let hiddenMemberCount = $derived(
	Math.max(0, avatarMembers.length - featuredMembers.length),
)
let alumniByName = $derived(
	new Map(data.alumni.map((person) => [person.nickname, person])),
)
let alumniByGitHub = $derived(
	new Map(data.alumni.map((person) => [person.id, person])),
)
let visibleSources = $derived((data.blogSources ?? []).slice(0, 50))
let homeActivityPeriod = $derived(getActivityPeriod(selectedHomeActivityPeriod))
let hasGitHubActivityData = $derived(data.githubActivity.members.length > 0)
let activeMembers = $derived.by(() =>
	data.githubActivity.members
		.map((member) => ({
			contributions: getContributionCount(member, homeActivityPeriod.days),
			member,
		}))
		.filter((item) => item.contributions > 0)
		.sort((a, b) => {
			if (b.contributions !== a.contributions) {
				return b.contributions - a.contributions
			}
			return b.member.totalContributions - a.member.totalContributions
		})
		.slice(0, 5),
)
let siteStatsItems = $derived.by(() =>
	[
		{
			icon: 'views' as const,
			label: '页面浏览',
			value: data.siteStats.pageViews,
			title: `近 ${data.siteStats.range.days} 天 Cloudflare Web Analytics 页面浏览${data.siteStats.excludeBots ? '（已排除机器人）' : ''}`,
		},
		{
			icon: 'visitors' as const,
			label: '访问',
			value: data.siteStats.visits,
			title: `近 ${data.siteStats.range.days} 天 Cloudflare Web Analytics 访问次数（非独立访客${data.siteStats.excludeBots ? '，已排除机器人' : ''}）`,
		},
	].filter(
		(
			item,
		): item is {
			icon: SiteStatsIcon
			label: string
			value: number
			title: string
		} => typeof item.value === 'number' && Number.isFinite(item.value),
	),
)
let hasSiteStats = $derived(
	data.siteStats.available && siteStatsItems.length > 0,
)

onMount(() => {
	themeMode = getSavedThemeMode()
	resolvedTheme = resolveThemeMode(themeMode)
	selectedHomeActivityPeriod = getSavedHomeActivityPeriod()
	readPostUrls = loadReadPostUrls()
	memberSample = shuffleMembers(avatarMembers).slice(0, sidebarMemberLimit)
	randomizeProjects()

	return watchSystemTheme((systemTheme) => {
		if (themeMode === 'auto') {
			resolvedTheme = systemTheme
		}
	})
})

function shuffleMembers(members: PageData['alumni']) {
	return shuffleItems(members)
}

function shuffleItems<T>(items: T[]) {
	const shuffled = [...items]

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1))
		;[shuffled[index], shuffled[swapIndex]] = [
			shuffled[swapIndex],
			shuffled[index],
		]
	}

	return shuffled
}

function shuffleMemberList() {
	memberOrder = shuffleMembers(data.alumni)
}

function randomizeProjects() {
	projectSample = shuffleItems(data.projects).slice(0, HOME_PROJECT_LIMIT)
}

function cycleHomeActivityPeriod() {
	const nextPeriod = getNextActivityPeriodKey(selectedHomeActivityPeriod)

	selectedHomeActivityPeriod = nextPeriod
	saveHomeActivityPeriod(nextPeriod)
}

function setThemeMode(mode: ThemeMode) {
	themeMode = mode
	resolvedTheme = resolveThemeMode(mode)
	saveThemeMode(mode)
}

function getPostAvatar(sourceName: string): string | null {
	return alumniByName.get(sourceName)?.avatar ?? null
}

function getSavedHomeActivityPeriod(): ActivityPeriodKey {
	if (typeof localStorage === 'undefined') return '7d'

	const value = localStorage.getItem(HOME_ACTIVITY_STORAGE_KEY)
	return isActivityPeriodKey(value) ? value : '7d'
}

function saveHomeActivityPeriod(period: ActivityPeriodKey) {
	if (typeof localStorage === 'undefined') return

	localStorage.setItem(HOME_ACTIVITY_STORAGE_KEY, period)
}

function isPostRead(url: string): boolean {
	return readPostUrls.has(url)
}

function markPostAsRead(url: string) {
	if (typeof localStorage === 'undefined') return

	const readAt = Date.now()
	const records = loadReadPostRecords(readAt)

	records[url] = readAt
	saveReadPostRecords(records)
	readPostUrls = new Set(Object.keys(records))
}

function loadReadPostUrls(now = Date.now()): Set<string> {
	const records = loadReadPostRecords(now)
	saveReadPostRecords(records)

	return new Set(Object.keys(records))
}

function loadReadPostRecords(now = Date.now()): Record<string, number> {
	if (typeof localStorage === 'undefined') return {}

	try {
		const parsed = JSON.parse(
			localStorage.getItem(READ_POSTS_STORAGE_KEY) ?? '{}',
		)
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return {}
		}

		const records: Record<string, number> = {}

		for (const [url, readAt] of Object.entries(parsed)) {
			if (
				typeof readAt === 'number' &&
				Number.isFinite(readAt) &&
				now - readAt <= READ_POST_TTL_MS
			) {
				records[url] = readAt
			}
		}

		return records
	} catch {
		return {}
	}
}

function saveReadPostRecords(records: Record<string, number>) {
	if (typeof localStorage === 'undefined') return

	try {
		localStorage.setItem(READ_POSTS_STORAGE_KEY, JSON.stringify(records))
	} catch {
		// Ignore storage quota and private-mode failures; the link click should continue.
	}
}

function sourceStatusLabel(status: string): string {
	switch (status) {
		case 'ok':
			return '正常'
		case 'empty':
			return '未发现'
		case 'error':
			return '失败'
		case 'stale':
			return '沿用上次'
		default:
			return status
	}
}
</script>

<Seo
	description={HOME_DESCRIPTION}
	jsonLd={homeJsonLd}
	path="/"
	title={HOME_TITLE}
/>

<div
	class:dark={resolvedTheme === 'dark'}
	class="min-h-screen bg-[#f3f5f7] text-[#202124] selection:bg-[#7dd3fc]/30 dark:bg-[#111418] dark:text-[#e8eaed]"
>
	<SiteHeader
		brandAriaLabel="回到文章列表"
		brandHref="#feed"
		onThemeModeChange={setThemeMode}
		{resolvedTheme}
		searchItems={data.searchIndex}
		showArticlesLink
		showProjectsLink
		subtitle="开发者社区"
		{themeMode}
	/>

	<main class="mx-auto grid max-w-[1056px] gap-5 px-4 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_300px]">
		<section id="feed" class="min-w-0 scroll-mt-20 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(31,35,40,0.08)] dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
			<div class="flex items-center justify-between gap-4 px-4 py-3 shadow-[0_1px_0_rgba(31,35,40,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
				<div class="flex min-w-0 items-center gap-3">
					<h1 class="text-base font-semibold">文章</h1>
					<span class="hidden truncate text-sm text-[#6b7280] sm:inline dark:text-[#9aa4b2]">
						{data.blogPostCount} 篇 · {formatGeneratedAt(data.blogPostsGeneratedAt)}
					</span>
				</div>
				<a
					href={SUBMIT_ALUMNI_URL}
					target="_blank"
					rel="noopener noreferrer"
					class="shrink-0 rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-medium text-[#0969da] hover:bg-[#ddf4ff] dark:bg-[#10233a] dark:text-[#7cc4ff] dark:hover:bg-[#17314f]"
				>
					提交收录
				</a>
			</div>

			{#if homePosts.length === 0}
				<div class="px-5 py-12 text-sm text-[#6b7280] dark:text-[#9aa4b2]">
					暂无文章数据。运行 <code class="rounded bg-[#eef2f7] px-1.5 py-0.5 dark:bg-[#202631]">npm --prefix frontend run collect:posts</code> 后会显示。
				</div>
			{:else}
				<div>
					{#each homePosts as post}
						<a
							href={post.url}
							target="_blank"
							rel="noopener noreferrer"
							onclick={() => markPostAsRead(post.url)}
							class="group flex gap-3 px-4 py-3 shadow-[0_1px_0_rgba(31,35,40,0.07)] last:shadow-none hover:bg-[#f8fafc] dark:shadow-[0_1px_0_rgba(255,255,255,0.07)] dark:hover:bg-[#1b2129]"
						>
							{#if getPostAvatar(post.sourceName)}
								<img
									src={getPostAvatar(post.sourceName)}
									alt={post.sourceName}
									class="mt-1 h-10 w-10 rounded-xl bg-[#eef2f7] object-cover dark:bg-[#202631]"
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<div class="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef6ff] text-sm font-semibold text-[#0969da] dark:bg-[#10233a] dark:text-[#7cc4ff]">
									文
								</div>
							{/if}

							<div class="min-w-0 flex-1">
								<h2 class="line-clamp-2 text-[15px] font-semibold leading-6 {isPostRead(post.url)
									? 'text-[#6b7280] group-hover:text-[#4b5563] dark:text-[#7f8a99] dark:group-hover:text-[#9aa4b2]'
									: 'text-[#1d4ed8] group-hover:text-[#0f3a9c] dark:text-[#80bfff] dark:group-hover:text-[#a7d5ff]'}">
									{post.title}
								</h2>
								<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6b7280] dark:text-[#9aa4b2]">
									<span class="font-medium text-[#374151] dark:text-[#cbd5e1]">{post.sourceName}</span>
									<span>{formatPostDate(post.publishedAt)}</span>
									{#if post.discoveredBy === 'feed'}
										<span class="inline-flex items-center gap-1">
											<svg class="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
												<path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm1 0v10h10V3H3z"></path>
												<path d="M5 5h6v1H5V5zm0 2h6v1H5V7zm0 2h4v1H5V9z"></path>
											</svg>
											RSS
										</span>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>
				{#if hasMorePosts}
					<div class="px-4 py-3 text-center shadow-[0_-1px_0_rgba(31,35,40,0.07)] dark:shadow-[0_-1px_0_rgba(255,255,255,0.07)]">
						<a
							href="/articles"
							class="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-[#0969da] hover:bg-[#eef6ff] dark:text-[#7cc4ff] dark:hover:bg-[#10233a]"
						>
							查看更多文章
						</a>
					</div>
				{/if}
			{/if}
		</section>

		<aside class="space-y-4">
			{#if hasGitHubActivityData}
				<section class="overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(31,35,40,0.08)] dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
					<div class="flex items-center justify-between gap-3 px-3 py-2.5 shadow-[0_1px_0_rgba(31,35,40,0.08)] sm:px-4 dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
						<a
							href="/activity"
							class="group inline-flex min-w-0 items-center gap-1 text-sm font-semibold hover:text-[#0969da] dark:hover:text-[#7cc4ff]"
							aria-label="查看完整活跃榜"
						>
							近期活跃
							<svg class="h-3.5 w-3.5 text-[#6b7280] group-hover:text-[#0969da] dark:text-[#9aa4b2] dark:group-hover:text-[#7cc4ff]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
								<path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"></path>
							</svg>
						</a>
						<button
							type="button"
							onclick={cycleHomeActivityPeriod}
							class="text-xs text-[#6b7280] dark:text-[#9aa4b2]"
							aria-label={`切换近期活跃时段，当前${homeActivityPeriod.homeLabel}`}
							title="切换时段"
						>
							{homeActivityPeriod.homeLabel}
						</button>
					</div>
					{#if activeMembers.length === 0}
						<div class="px-4 py-4 text-sm text-[#6b7280] dark:text-[#9aa4b2]">
							暂无活跃数据
						</div>
					{:else}
						<div>
							{#each activeMembers as item}
								{@const member = item.member}
								{@const activityView = getActivityMemberView(member, alumniByGitHub)}
								<a
									href={activityView.href}
									class="flex items-center gap-2.5 px-3 py-2 shadow-[0_1px_0_rgba(31,35,40,0.07)] last:shadow-none hover:bg-[#f8fafc] sm:px-4 dark:shadow-[0_1px_0_rgba(255,255,255,0.07)] dark:hover:bg-[#1b2129]"
								>
									<img
										src={activityView.avatar}
										alt={activityView.displayName}
										class="h-8 w-8 rounded-lg bg-[#eef2f7] object-cover dark:bg-[#202631]"
										loading="lazy"
										decoding="async"
										referrerpolicy="no-referrer"
									/>
									<div class="min-w-0 flex-1">
										<div class="flex items-center justify-between gap-3">
											<div class="flex min-w-0 items-baseline gap-1.5">
												<p class="truncate text-sm font-medium">{activityView.displayName}</p>
												<p class="hidden truncate text-xs text-[#6b7280] sm:block dark:text-[#9aa4b2]">@{member.github}</p>
											</div>
											<p class="shrink-0 text-sm font-semibold">
												{formatMetric(item.contributions)}
												<span class="ml-0.5 text-xs font-normal text-[#6b7280] dark:text-[#9aa4b2]">贡献</span>
											</p>
										</div>
									</div>
								</a>
							{/each}
						</div>
					{/if}
				</section>
			{/if}

			<section
				id="projects"
				class="scroll-mt-20 rounded-2xl bg-white shadow-[0_1px_3px_rgba(31,35,40,0.08)] dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
			>
				<div class="flex items-center justify-between gap-3 px-3 py-1.5 shadow-[0_1px_0_rgba(31,35,40,0.08)] sm:px-4 dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
					<div class="min-w-0">
						<h2 class="text-sm font-semibold">
							<a
								href="/projects"
								class="group inline-flex min-w-0 items-center gap-1 hover:text-[#0969da] dark:hover:text-[#7cc4ff]"
								aria-label="查看完整项目列表"
							>
								项目
								<svg class="h-3.5 w-3.5 text-[#6b7280] group-hover:text-[#0969da] dark:text-[#9aa4b2] dark:group-hover:text-[#7cc4ff]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
									<path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"></path>
								</svg>
							</a>
						</h2>
					</div>
					<div class="flex shrink-0 items-center gap-1">
						<button
							type="button"
							onclick={randomizeProjects}
							class="flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#eef2f7] dark:text-[#9aa4b2] dark:hover:bg-[#202631]"
							aria-label="换一批项目"
							title="换一批项目"
						>
							<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path d="M3 12a9 9 0 0 1 9-9 9.8 9.8 0 0 1 6.74 2.74L21 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
								<path d="M21 3v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
								<path d="M21 12a9 9 0 0 1-9 9 9.8 9.8 0 0 1-6.74-2.74L3 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
								<path d="M8 16H3v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</button>
					</div>
				</div>
				<div>
					{#each featuredProjects as project}
						<a
							href={project.url}
							target="_blank"
							rel="noopener noreferrer"
							class="flex gap-2.5 px-3 py-2.5 shadow-[0_1px_0_rgba(31,35,40,0.07)] last:shadow-none hover:bg-[#f8fafc] sm:px-4 dark:shadow-[0_1px_0_rgba(255,255,255,0.07)] dark:hover:bg-[#1b2129]"
						>
							{#if project.author.avatar}
								<img
									src={project.author.avatar}
									alt={project.author.name}
									class="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[#eef2f7] object-cover dark:bg-[#202631]"
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-xs font-semibold text-[#6b7280] dark:bg-[#202631] dark:text-[#9aa4b2]">
									{project.author.name.charAt(0).toUpperCase()}
								</div>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="line-clamp-1 text-sm font-semibold text-[#1d4ed8] dark:text-[#80bfff]">{project.name}</p>
								<p class="mt-1 line-clamp-1 text-xs leading-5 text-[#6b7280] dark:text-[#9aa4b2]">
									{project.description}
								</p>
								<div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#6b7280] dark:text-[#9aa4b2]">
									<span>{project.author.github ? `@${project.author.github}` : project.author.name}</span>
									{#each project.languages.slice(0, 2) as language}
										<span aria-hidden="true">·</span>
										<span class="inline-flex items-center gap-1">
											<span
												class="h-2 w-2 rounded-full"
												style={`background-color: ${language.color};`}
											></span>
											{language.name}
										</span>
									{/each}
								</div>
							</div>
						</a>
					{/each}
				</div>
			</section>

			<section class="rounded-2xl bg-white overflow-hidden shadow-[0_1px_3px_rgba(31,35,40,0.08)] dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
				<div>
					<a
						href={REPOSITORY_URL}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-3 px-3 py-2.5 hover:bg-[#f8fafc] sm:px-4 dark:hover:bg-[#1b2129]"
					>
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
							<svg class="h-7 w-7" fill="currentColor" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Github</title><path d="M12 0c6.63 0 12 5.276 12 11.79-.001 5.067-3.29 9.567-8.175 11.187-.6.118-.825-.25-.825-.56 0-.398.015-1.665.015-3.242 0-1.105-.375-1.813-.81-2.181 2.67-.295 5.475-1.297 5.475-5.822 0-1.297-.465-2.344-1.23-3.169.12-.295.54-1.503-.12-3.125 0 0-1.005-.324-3.3 1.209a11.32 11.32 0 00-3-.398c-1.02 0-2.04.133-3 .398-2.295-1.518-3.3-1.209-3.3-1.209-.66 1.622-.24 2.83-.12 3.125-.765.825-1.23 1.887-1.23 3.169 0 4.51 2.79 5.527 5.46 5.822-.345.294-.66.81-.765 1.577-.69.31-2.415.81-3.495-.973-.225-.354-.9-1.223-1.845-1.209-1.005.015-.405.56.015.781.51.28 1.095 1.327 1.23 1.666.24.663 1.02 1.93 4.035 1.385 0 .988.015 1.916.015 2.196 0 .31-.225.664-.825.56C3.303 21.374-.003 16.867 0 11.791 0 5.276 5.37 0 12 0z"></path></svg>
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium">GitHub 仓库</p>
							<p class="text-xs text-[#6b7280] dark:text-[#9aa4b2]">dogxii/ZZULI.dev</p>
						</div>
						<svg class="h-4 w-4 text-[#6b7280] dark:text-[#9aa4b2]" viewBox="0 0 16 16" fill="currentColor">
							<path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"></path>
						</svg>
					</a>

					<a
						href="https://qm.qq.com/cgi-bin/qm/qr?k=1q3IN4-zn7JIQYdtBIIMF3N4otjgqB51&jump_from=webapi&authKey=nrhi6CY7BcXgEPiTqrs5+5NFX7um+Z9GKJbERupRl1XWfEPWiSm3abjXf/W4/3g9"
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-3 px-3 py-2.5 hover:bg-[#f8fafc] sm:px-4 dark:hover:bg-[#1b2129]"
					>
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
							<img src="https://wiki.connect.qq.com/wp-content/uploads/2013/10/03_qq_symbol-1-768x921.png" alt="QQ" class="h-8 w-7" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium">QQ 交流群</p>
							<p class="text-xs text-[#6b7280] dark:text-[#9aa4b2]">733107768</p>
						</div>
						<svg class="h-4 w-4 text-[#6b7280] dark:text-[#9aa4b2]" viewBox="0 0 16 16" fill="currentColor">
							<path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"></path>
						</svg>
					</a>
				</div>
			</section>

			<section class="hidden rounded-2xl bg-white p-3 shadow-[0_1px_3px_rgba(31,35,40,0.08)] md:block dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
				<h2 class="text-sm font-semibold">成员</h2>
				<div class="mt-3 grid grid-cols-7 gap-2">
					{#each featuredMembers as person}
						<a
							href={person.profilePath}
							title={person.nickname}
							class="rounded-xl hover:ring-2 hover:ring-[#7dd3fc]/60"
						>
							<img
								src={person.avatar}
								alt={person.nickname}
								class="h-9 w-9 rounded-xl bg-[#eef2f7] object-cover dark:bg-[#202631]"
								loading="lazy"
								decoding="async"
								referrerpolicy="no-referrer"
							/>
						</a>
					{/each}
					{#if hiddenMemberCount > 0}
						<a
							href="#members"
							title={`还有 ${hiddenMemberCount} 位成员`}
							aria-label={`还有 ${hiddenMemberCount} 位成员`}
							class="flex h-9 w-9 place-self-center items-center justify-center rounded-xl bg-[#f3f5f7] text-lg font-semibold leading-none text-[#6b7280] hover:bg-[#e5eaf0] dark:bg-[#202631] dark:text-[#9aa4b2] dark:hover:bg-[#2a3340]"
						>
							…
						</a>
					{/if}
				</div>
			</section>

			<section class="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(31,35,40,0.08)] dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
				<div class="grid grid-cols-2 gap-3 text-sm">
					<a
						href="#feed"
						class="-m-2 block rounded-xl p-2 hover:bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#7dd3fc] dark:hover:bg-[#1b2129]"
						aria-label="查看文章"
					>
						<p class="text-xl font-semibold">{data.blogPostCount}</p>
						<p class="text-[#6b7280] dark:text-[#9aa4b2]">文章</p>
					</a>
					<a
						href="#members"
						class="-m-2 block rounded-xl p-2 hover:bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#7dd3fc] dark:hover:bg-[#1b2129]"
						aria-label="查看成员"
					>
						<p class="text-xl font-semibold">{totalAlumni}</p>
						<p class="text-[#6b7280] dark:text-[#9aa4b2]">成员</p>
					</a>
					<a
						href="#projects"
						class="-m-2 block rounded-xl p-2 hover:bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#7dd3fc] dark:hover:bg-[#1b2129]"
						aria-label="查看项目"
					>
						<p class="text-xl font-semibold">{totalProjects}</p>
						<p class="text-[#6b7280] dark:text-[#9aa4b2]">项目</p>
					</a>
					<a
						href="#sources"
						onclick={() => (sourcesExpanded = true)}
						class="-m-2 block rounded-xl p-2 hover:bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#7dd3fc] dark:hover:bg-[#1b2129]"
						aria-label="查看文章来源"
					>
						<p class="text-xl font-semibold">{totalBlogs}</p>
						<p class="text-[#6b7280] dark:text-[#9aa4b2]">文章源</p>
					</a>
				</div>
			</section>

			<footer class="px-1 pb-1 text-xs leading-5 text-[#8b949e] dark:text-[#6e7681]">
				{#if hasSiteStats}
					<div class="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-4">
						{#each siteStatsItems as item}
							<span class="inline-flex items-center gap-1" title={item.title}>
								{#if item.icon === 'views'}
									<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<path d="M1.75 8s2.5-4 6.25-4 6.25 4 6.25 4-2.5 4-6.25 4-6.25-4-6.25-4Z"></path>
										<circle cx="8" cy="8" r="1.75"></circle>
									</svg>
								{:else}
									<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<circle cx="6" cy="5" r="2.25"></circle>
										<path d="M2.75 13c.35-2.05 1.55-3.25 3.25-3.25S8.9 10.95 9.25 13"></path>
										<path d="M10.25 7.25a2 2 0 0 0 .5-3.85"></path>
										<path d="M11 10c1.25.2 2.05 1.15 2.25 3"></path>
									</svg>
								{/if}
								<span>{item.label} {formatMetric(item.value)}</span>
							</span>
						{/each}
						<span>(&larr;每日更新)</span>
					</div>
				{/if}
				<nav class="flex flex-wrap items-center gap-x-1.5 gap-y-1" aria-label="站点链接">
					<a
						href={REPOSITORY_URL}
						target="_blank"
						rel="noopener noreferrer"
						class="hover:text-[#0969da] dark:hover:text-[#7cc4ff]"
					>
						GitHub
					</a>
					<span aria-hidden="true">·</span>
					<a
						href={SUBMIT_ALUMNI_URL}
						target="_blank"
						rel="noopener noreferrer"
						class="hover:text-[#0969da] dark:hover:text-[#7cc4ff]"
					>
						提交收录
					</a>
					<span aria-hidden="true">·</span>
					<a
						href={SUBMIT_PROJECT_URL}
						target="_blank"
						rel="noopener noreferrer"
						class="hover:text-[#0969da] dark:hover:text-[#7cc4ff]"
					>
						提交项目
					</a>
					<span aria-hidden="true">·</span>
					<a
						href="/links"
						class="hover:text-[#0969da] dark:hover:text-[#7cc4ff]"
					>
						友情链接
					</a>
				</nav>
				<div class="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
					<span>© {COPYRIGHT_YEAR} ZZULI.dev</span>
					<span aria-hidden="true">·</span>
					<a
						href={`mailto:${CONTACT_EMAIL}`}
						class="inline-flex items-center hover:text-[#0969da] dark:hover:text-[#7cc4ff]"
						aria-label={`发送邮件到 ${CONTACT_EMAIL}`}
						title={CONTACT_EMAIL}
					>
						<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M2.75 4.25h10.5v7.5H2.75z"></path>
							<path d="m3.25 4.75 4.75 3.5 4.75-3.5"></path>
						</svg>
					</a>
					<span aria-hidden="true">·</span>
					<a
						href="/sitemap.xml"
						class="inline-flex items-center hover:text-[#0969da] dark:hover:text-[#7cc4ff]"
						aria-label="查看 Sitemap"
						title="Sitemap"
					>
						<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M8 2.5v3"></path>
							<path d="M4 8.5v2"></path>
							<path d="M12 8.5v2"></path>
							<path d="M4 8.5h8"></path>
							<path d="M8 5.5v3"></path>
							<rect x="5.75" y="1.5" width="4.5" height="2.5" rx="0.75"></rect>
							<rect x="1.75" y="10.5" width="4.5" height="2.5" rx="0.75"></rect>
							<rect x="9.75" y="10.5" width="4.5" height="2.5" rx="0.75"></rect>
						</svg>
					</a>
				</div>
				<p class="mt-1">本站由校友自发创建，非学校官方网站，与学校无任何隶属关系，不代表官方立场；本站大部分数据均为每日更新</p>
			</footer>
		</aside>

		<section
			id="members"
			class="min-w-0 scroll-mt-20 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(31,35,40,0.08)] md:col-span-2 dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
		>
			<div class="flex flex-col gap-3 px-4 py-3 shadow-[0_1px_0_rgba(31,35,40,0.08)] sm:flex-row sm:items-center sm:justify-between dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
				<div>
					<h2 class="text-sm font-semibold">成员</h2>
				</div>
				<div class="flex w-full gap-2 sm:w-auto">
					<label class="block min-w-0 flex-1 sm:w-80">
						<span class="sr-only">搜索成员</span>
						<input
							type="search"
							bind:value={searchTerm}
							placeholder="搜索昵称、GitHub 或博客"
							class="w-full rounded-full bg-[#f3f5f7] px-4 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-[#7dd3fc] dark:bg-[#202631]"
						/>
					</label>
					<button
						type="button"
						onclick={shuffleMemberList}
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#eef2f7] dark:text-[#9aa4b2] dark:hover:bg-[#202631]"
						aria-label="随机成员排序"
						title="随机成员排序"
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path d="M3 12a9 9 0 0 1 9-9 9.8 9.8 0 0 1 6.74 2.74L21 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							<path d="M21 3v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							<path d="M21 12a9 9 0 0 1-9 9 9.8 9.8 0 0 1-6.74-2.74L3 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							<path d="M8 16H3v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
				</div>
			</div>

			<div class="grid sm:grid-cols-2 lg:grid-cols-3">
				{#each filteredAlumni as person}
					<article class="px-4 py-3 shadow-[1px_1px_0_rgba(31,35,40,0.07)] dark:shadow-[1px_1px_0_rgba(255,255,255,0.07)]">
						<a
							href={person.profilePath}
							class="flex items-center gap-3 rounded-xl hover:text-[#0969da] dark:hover:text-[#7cc4ff]"
						>
							{#if person.avatar}
								<img
									src={person.avatar}
									alt={person.nickname}
									class="h-10 w-10 rounded-xl bg-[#eef2f7] object-cover dark:bg-[#202631]"
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2f7] text-sm font-semibold text-[#6b7280] dark:bg-[#202631] dark:text-[#9aa4b2]">
									{person.nickname.charAt(0).toUpperCase()}
								</div>
							{/if}

							<div class="min-w-0 flex-1">
								<h3 class="truncate text-sm font-semibold">{person.nickname}</h3>
								<p class="truncate text-xs text-[#6b7280] dark:text-[#9aa4b2]">@{person.github.username}</p>
							</div>
						</a>

						<div class="mt-3 flex gap-2">
							{#if person.github.url}
								<a
									href={person.github.url}
									target="_blank"
									rel="noopener noreferrer"
									class="rounded-full bg-[#f3f5f7] px-2.5 py-1 text-xs hover:bg-[#e5eaf0] dark:bg-[#202631] dark:hover:bg-[#2a3340]"
								>
									GitHub
								</a>
							{/if}
							{#if person.blog?.url}
								<a
									href={person.blog.url}
									target="_blank"
									rel="noopener noreferrer"
									title={person.blog.name}
									class="max-w-36 truncate rounded-full bg-[#eef6ff] px-2.5 py-1 text-xs text-[#0969da] hover:bg-[#ddf4ff] dark:bg-[#10233a] dark:text-[#7cc4ff] dark:hover:bg-[#17314f]"
								>
									{person.blog.name}
								</a>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		</section>

		<section
			id="sources"
			class="min-w-0 scroll-mt-20 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(31,35,40,0.08)] md:col-span-2 dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
		>
			<div class="flex items-center justify-between gap-3 px-4 py-2.5 text-[#6b7280] shadow-[0_1px_0_rgba(31,35,40,0.06)] dark:text-[#9aa4b2] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]">
				<div class="flex min-w-0 items-center gap-1.5">
					<button
						type="button"
						onclick={() => (sourcesExpanded = !sourcesExpanded)}
						class="group inline-flex min-w-0 items-center gap-1.5 text-left hover:text-[#202124] dark:hover:text-[#e8eaed]"
						aria-expanded={sourcesExpanded}
						aria-controls="sources-list"
					>
						<span class="text-sm font-semibold">文章来源</span>
						<span class="truncate text-xs">
							{visibleSources.length} 个
						</span>
					</button>
					<button
						type="button"
						class="group relative z-30 flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full outline-none hover:bg-[#eef2f7] dark:hover:bg-[#202631]"
						aria-label={sourceHelpText}
						title={sourceHelpText}
					>
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
							<path d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							<path d="M12 17h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
						</svg>
						<span class="pointer-events-none absolute left-7 top-1/2 z-50 w-max max-w-64 -translate-y-1/2 rounded-lg bg-[#24292f] px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 dark:bg-[#30363d]">
							{sourceHelpText}
						</span>
					</button>
				</div>
				<button
					type="button"
					onclick={() => (sourcesExpanded = !sourcesExpanded)}
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[#eef2f7] dark:hover:bg-[#202631]"
					aria-label={sourcesExpanded ? '收起文章来源' : '展开文章来源'}
					aria-expanded={sourcesExpanded}
					aria-controls="sources-list"
				>
					<svg
						class="h-4 w-4 transition-transform {sourcesExpanded ? 'rotate-180' : ''}"
						viewBox="0 0 16 16"
						fill="currentColor"
						aria-hidden="true"
					>
						<path d="M3.22 5.72a.75.75 0 0 1 1.06 0L8 9.44l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.22 6.78a.75.75 0 0 1 0-1.06Z"></path>
					</svg>
				</button>
			</div>
			{#if sourcesExpanded}
				<div id="sources-list" class="grid sm:grid-cols-2 lg:grid-cols-5">
					{#each visibleSources as source}
						<a
							href={source.url}
							target="_blank"
							rel="noopener noreferrer"
							class="px-4 py-3 shadow-[1px_1px_0_rgba(31,35,40,0.07)] hover:bg-[#f8fafc] dark:shadow-[1px_1px_0_rgba(255,255,255,0.07)] dark:hover:bg-[#1b2129]"
						>
							<p class="truncate text-sm font-medium">{source.name}</p>
							<p class="mt-1 truncate text-xs text-[#6b7280] dark:text-[#9aa4b2]">
								{sourceStatusLabel(source.status)} · {source.itemCount} 条
							</p>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	</main>

</div>

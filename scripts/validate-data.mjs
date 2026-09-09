import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
)
const errors = []
const ARTICLE_HASH_HINT =
	/^#(?:!?\/)?(?:article|articles|post|posts|entry|entries|blog|p)(?:[/?#-]|$)/i

function readJson(relativePath) {
	const absolutePath = path.join(ROOT_DIR, relativePath)
	return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
}

function addError(pathLabel, message) {
	errors.push(`${pathLabel}: ${message}`)
}

function isNonEmptyString(value) {
	return typeof value === 'string' && value.trim().length > 0
}

function normalizeGitHubUsername(value) {
	return String(value ?? '')
		.trim()
		.replace(/^@/, '')
		.toLowerCase()
}

function isGitHubUsername(value) {
	return /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value)
}

function isHttpUrl(value) {
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

function normalizeUrlKey(value, options = {}) {
	try {
		const url = new URL(value)
		if (!options.preserveArticleHash || !ARTICLE_HASH_HINT.test(url.hash)) {
			url.hash = ''
		}
		url.pathname = url.pathname.replace(/\/+$/, '') || '/'
		return url.toString().toLowerCase()
	} catch {
		return String(value ?? '')
			.trim()
			.replace(/\/+$/, '')
			.toLowerCase()
	}
}

function isDate(value) {
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		!Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
	)
}

function isDateTime(value) {
	return isNonEmptyString(value) && !Number.isNaN(new Date(value).getTime())
}

function isNonNegativeNumber(value) {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validateNullableDate(value, pathLabel) {
	if (value !== null && value !== undefined && !isDate(value)) {
		addError(pathLabel, `必须是 YYYY-MM-DD 或 null: ${value}`)
	}
}

function validateNullableDateTime(value, pathLabel) {
	if (value !== null && value !== undefined && !isDateTime(value)) {
		addError(pathLabel, `必须是有效日期时间或 null: ${value}`)
	}
}

function validateNullableCount(value, pathLabel) {
	if (value !== null && value !== undefined && !isNonNegativeNumber(value)) {
		addError(pathLabel, `必须是非负数字或 null: ${value}`)
	}
}

function validateGitHubCalendar(calendar, pathLabel) {
	if (Array.isArray(calendar)) {
		calendar.forEach((day, dayIndex) => {
			const dayPath = `${pathLabel}[${dayIndex}]`
			if (!isDate(day.date)) {
				addError(dayPath, `date 必须是 YYYY-MM-DD: ${day.date ?? ''}`)
			}
			validateNullableCount(day.count, `${dayPath}.count`)
			if (!isNonEmptyString(day.color)) {
				addError(dayPath, 'color 不能为空')
			}
		})
		return
	}

	if (!calendar || typeof calendar !== 'object') {
		addError(pathLabel, '必须是数组或紧凑对象')
		return
	}

	if (!isDate(calendar.start)) {
		addError(`${pathLabel}.start`, `必须是 YYYY-MM-DD: ${calendar.start ?? ''}`)
	}
	if (!Array.isArray(calendar.counts)) {
		addError(`${pathLabel}.counts`, '必须是数组')
		return
	}

	calendar.counts.forEach((count, index) => {
		validateNullableCount(count, `${pathLabel}.counts[${index}]`)
	})

	if (calendar.colors !== undefined && !Array.isArray(calendar.colors)) {
		addError(`${pathLabel}.colors`, '必须是数组')
	}
}

function checkUnique(key, value, seen, pathLabel) {
	if (!value) {
		return
	}

	if (seen.has(value)) {
		addError(pathLabel, `${key} 重复: ${value}`)
	} else {
		seen.add(value)
	}
}

function validateAlumni() {
	const alumni = readJson('data/alumni.json')
	if (!Array.isArray(alumni)) {
		addError('data/alumni.json', '顶层必须是数组')
		return 0
	}

	const githubs = new Set()
	const nicknames = new Set()

	alumni.forEach((person, index) => {
		const pathLabel = `data/alumni.json[${index}]`
		if (!isNonEmptyString(person.nickname)) {
			addError(pathLabel, 'nickname 不能为空')
		}
		if (!isNonEmptyString(person.github)) {
			addError(pathLabel, 'github 不能为空')
		} else if (!isGitHubUsername(person.github)) {
			addError(pathLabel, `github 格式不正确: ${person.github}`)
		}

		checkUnique(
			'github',
			normalizeGitHubUsername(person.github),
			githubs,
			pathLabel,
		)
		checkUnique(
			'nickname',
			String(person.nickname ?? '')
				.trim()
				.toLowerCase(),
			nicknames,
			pathLabel,
		)
		validateNullableDate(person.joinedAt, `${pathLabel}.joinedAt`)

		if (person.blog) {
			if (!isNonEmptyString(person.blog.name)) {
				addError(pathLabel, 'blog.name 不能为空')
			}
			if (!isNonEmptyString(person.blog.url) || !isHttpUrl(person.blog.url)) {
				addError(
					pathLabel,
					`blog.url 必须是 http(s) URL: ${person.blog.url ?? ''}`,
				)
			}
		}
	})

	return alumni.length
}

function validateProjects() {
	const projects = readJson('data/projects.json')
	if (!Array.isArray(projects)) {
		addError('data/projects.json', '顶层必须是数组')
		return 0
	}

	const urls = new Set()

	projects.forEach((project, index) => {
		const pathLabel = `data/projects.json[${index}]`
		if (!isNonEmptyString(project.name)) {
			addError(pathLabel, 'name 不能为空')
		}
		if (!isNonEmptyString(project.url) || !isHttpUrl(project.url)) {
			addError(pathLabel, `url 必须是 http(s) URL: ${project.url ?? ''}`)
		}
		checkUnique('url', normalizeUrlKey(project.url), urls, pathLabel)
		if (!isNonEmptyString(project.description)) {
			addError(pathLabel, 'description 不能为空')
		}
		if (!project.author || typeof project.author !== 'object') {
			addError(pathLabel, 'author 必须是对象')
		} else {
			if (!isNonEmptyString(project.author.name)) {
				addError(pathLabel, 'author.name 不能为空')
			}
			if (project.author.github && !isGitHubUsername(project.author.github)) {
				addError(
					pathLabel,
					`author.github 格式不正确: ${project.author.github}`,
				)
			}
		}
		if (!Array.isArray(project.languages) || project.languages.length === 0) {
			addError(pathLabel, 'languages 必须是非空数组')
		} else {
			project.languages.forEach((language, languageIndex) => {
				if (!isNonEmptyString(language)) {
					addError(`${pathLabel}.languages[${languageIndex}]`, '语言不能为空')
				}
			})
		}
		if (!isDate(project.submittedAt)) {
			addError(
				pathLabel,
				`submittedAt 必须是 YYYY-MM-DD: ${project.submittedAt ?? ''}`,
			)
		}
	})

	return projects.length
}

function validateBlogPosts() {
	const filePath = path.join(ROOT_DIR, 'data/blog-posts.json')
	if (!fs.existsSync(filePath)) {
		return 0
	}

	const data = readJson('data/blog-posts.json')
	if (!Array.isArray(data.posts)) {
		addError('data/blog-posts.json', 'posts 必须是数组')
		return 0
	}

	const urls = new Set()
	data.posts.forEach((post, index) => {
		const pathLabel = `data/blog-posts.json.posts[${index}]`
		if (!isNonEmptyString(post.title)) {
			addError(pathLabel, 'title 不能为空')
		}
		if (!isNonEmptyString(post.url) || !isHttpUrl(post.url)) {
			addError(pathLabel, `url 必须是 http(s) URL: ${post.url ?? ''}`)
		}
		checkUnique(
			'url',
			normalizeUrlKey(post.url, { preserveArticleHash: true }),
			urls,
			pathLabel,
		)
		if (!isNonEmptyString(post.sourceName)) {
			addError(pathLabel, 'sourceName 不能为空')
		}
		if (!isNonEmptyString(post.sourceUrl) || !isHttpUrl(post.sourceUrl)) {
			addError(
				pathLabel,
				`sourceUrl 必须是 http(s) URL: ${post.sourceUrl ?? ''}`,
			)
		}
		if (
			post.publishedAt &&
			Number.isNaN(new Date(post.publishedAt).getTime())
		) {
			addError(pathLabel, `publishedAt 不是有效日期: ${post.publishedAt}`)
		}
	})

	return data.posts.length
}

function validateGitHubActivity() {
	const filePath = path.join(ROOT_DIR, 'data/github-activity.json')
	if (!fs.existsSync(filePath)) {
		return 0
	}

	const data = readJson('data/github-activity.json')
	validateNullableDateTime(
		data.generatedAt,
		'data/github-activity.json.generatedAt',
	)
	validateNullableDate(data.range?.from, 'data/github-activity.json.range.from')
	validateNullableDate(data.range?.to, 'data/github-activity.json.range.to')
	if (
		!isNonNegativeNumber(data.range?.recentDays) ||
		data.range.recentDays < 1
	) {
		addError('data/github-activity.json.range.recentDays', '必须是正数')
	}
	if (!Array.isArray(data.members)) {
		addError('data/github-activity.json.members', '必须是数组')
		return 0
	}

	const githubs = new Set()
	data.members.forEach((member, index) => {
		const pathLabel = `data/github-activity.json.members[${index}]`
		if (!isGitHubUsername(member.github)) {
			addError(pathLabel, `github 格式不正确: ${member.github ?? ''}`)
		}
		checkUnique(
			'github',
			normalizeGitHubUsername(member.github),
			githubs,
			pathLabel,
		)
		if (!isNonEmptyString(member.url) || !isHttpUrl(member.url)) {
			addError(pathLabel, `url 必须是 http(s) URL: ${member.url ?? ''}`)
		}
		if (!isNonEmptyString(member.avatar) || !isHttpUrl(member.avatar)) {
			addError(pathLabel, `avatar 必须是 http(s) URL: ${member.avatar ?? ''}`)
		}
		validateNullableCount(
			member.latestDayContributions ?? member.todayContributions,
			`${pathLabel}.latestDayContributions`,
		)
		validateNullableCount(
			member.recentContributions,
			`${pathLabel}.recentContributions`,
		)
		validateNullableCount(
			member.totalContributions,
			`${pathLabel}.totalContributions`,
		)
		validateGitHubCalendar(member.calendar, `${pathLabel}.calendar`)
		if (!Array.isArray(member.recentRepositories)) {
			addError(`${pathLabel}.recentRepositories`, '必须是数组')
		} else {
			member.recentRepositories.forEach((repo, repoIndex) => {
				const repoPath = `${pathLabel}.recentRepositories[${repoIndex}]`
				if (!isNonEmptyString(repo.name)) {
					addError(repoPath, 'name 不能为空')
				}
				if (!isNonEmptyString(repo.nameWithOwner)) {
					addError(repoPath, 'nameWithOwner 不能为空')
				}
				if (!isNonEmptyString(repo.url) || !isHttpUrl(repo.url)) {
					addError(repoPath, `url 必须是 http(s) URL: ${repo.url ?? ''}`)
				}
				validateNullableDateTime(repo.pushedAt, `${repoPath}.pushedAt`)
				validateNullableCount(repo.stars, `${repoPath}.stars`)
				if (repo.language !== null && repo.language !== undefined) {
					if (!isNonEmptyString(repo.language.name)) {
						addError(repoPath, 'language.name 不能为空')
					}
					if (!isNonEmptyString(repo.language.color)) {
						addError(repoPath, 'language.color 不能为空')
					}
				}
			})
		}
	})

	return data.members.length
}

function validateSiteStats() {
	const filePath = path.join(ROOT_DIR, 'data/site-stats.json')
	if (!fs.existsSync(filePath)) {
		return 0
	}

	const data = readJson('data/site-stats.json')
	if (data.schemaVersion !== 2) {
		addError('data/site-stats.json.schemaVersion', '必须是 2')
	}
	validateNullableDateTime(data.generatedAt, 'data/site-stats.json.generatedAt')
	validateNullableDate(data.range?.from, 'data/site-stats.json.range.from')
	validateNullableDate(data.range?.to, 'data/site-stats.json.range.to')
	if (!isNonNegativeNumber(data.range?.days) || data.range.days < 1) {
		addError('data/site-stats.json.range.days', '必须是正数')
	}
	if (
		data.hostname !== null &&
		data.hostname !== undefined &&
		!isNonEmptyString(data.hostname)
	) {
		addError('data/site-stats.json.hostname', '必须是非空字符串或 null')
	}
	validateNullableCount(data.visits, 'data/site-stats.json.visits')
	validateNullableCount(data.pageViews, 'data/site-stats.json.pageViews')
	if (typeof data.excludeBots !== 'boolean') {
		addError('data/site-stats.json.excludeBots', '必须是 boolean')
	}
	if (
		data.source !== null &&
		data.source !== undefined &&
		!isNonEmptyString(data.source)
	) {
		addError('data/site-stats.json.source', '必须是非空字符串或 null')
	}
	if (typeof data.available !== 'boolean') {
		addError('data/site-stats.json.available', '必须是 boolean')
	}

	return data.available ? 1 : 0
}

const counts = {
	alumni: validateAlumni(),
	projects: validateProjects(),
	blogPosts: validateBlogPosts(),
	githubActivityMembers: validateGitHubActivity(),
	siteStats: validateSiteStats(),
}

if (errors.length > 0) {
	console.error(errors.map((error) => `- ${error}`).join('\n'))
	process.exit(1)
}

console.log(
	`数据校验通过: ${counts.alumni} 位成员, ${counts.projects} 个项目, ${counts.blogPosts} 篇文章, ${counts.githubActivityMembers} 位 GitHub 活跃成员, ${counts.siteStats} 份站点统计`,
)

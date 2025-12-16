<script lang="ts">
  import ParticleBackground from '$lib/components/ParticleBackground.svelte'
  import AvatarWall from '$lib/components/AvatarWall.svelte'
  import { fly, slide } from 'svelte/transition'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  let searchTerm = $state('')
  let activities = $state<
    Array<{
      user: string | null
      type: string
      repo: string
      date: Date
      avatar: string
      url: string
    }>
  >([])
  let loadingActivities = $state(true)

  // Computed Stats
  let totalAlumni = $derived(data.alumni.length)
  let totalProjects = $derived(data.projects.length)
  let filteredAlumni = $derived(
    data.alumni.filter((person) =>
      person.nickname.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  )

  // Helper to get GitHub username from URL
  const getUsername = (url: string | null): string | null => {
    if (!url) return null
    const match = url.match(/github\.com\/([^/]+)/)
    return match ? match[1] : null
  }

  // Fetch recent activity from GitHub for a random subset of users
  onMount(async () => {
    const usernames = data.alumni
      .map((p) => getUsername(p.github?.url))
      .filter(Boolean)

    // Shuffle and pick top 10 to avoid rate limits and keep it fast
    const shuffled = usernames.sort(() => 0.5 - Math.random()).slice(0, 8)

    const requests = shuffled.map((username) =>
      fetch(`https://api.github.com/users/${username}/events/public?per_page=3`)
        .then((res) => {
          if (!res.ok) return []
          return res.json()
        })
        .then((events) => {
          if (!Array.isArray(events)) return []
          return events.map((e) => ({
            user: username,
            type: e.type,
            repo: e.repo.name,
            date: new Date(e.created_at),
            avatar: e.actor.avatar_url,
            url: `https://github.com/${e.repo.name}`,
          }))
        })
        .catch(() => []),
    )

    const results = await Promise.all(requests)
    activities = results
      .flat()
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 15) // Keep top 15 recent events

    loadingActivities = false
  })

  function formatTime(date: Date): string {
    const now = new Date()
    const diff = (now.getTime() - date.getTime()) / 1000 // seconds

    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  function formatEventType(type: string): string {
    switch (type) {
      case 'PushEvent':
        return 'pushed to'
      case 'WatchEvent':
        return 'starred'
      case 'CreateEvent':
        return 'created'
      case 'ForkEvent':
        return 'forked'
      case 'IssuesEvent':
        return 'opened issue in'
      case 'PullRequestEvent':
        return 'opened PR in'
      default:
        return 'contributed to'
    }
  }
</script>

<svelte:head>
  <title>ZZULI Developers | Community Hub</title>
</svelte:head>

<ParticleBackground />

<div
  class="relative z-10 min-h-screen text-slate-300 font-sans selection:bg-cyan-500/30"
>
  <!-- Hero Section -->
  <section class="relative pt-20 pb-2 sm:pb-18 overflow-hidden">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <div
        in:fly={{ y: 20, duration: 800, delay: 200 }}
        class="inline-flex items-center px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-sm font-medium mb-8 backdrop-blur-sm"
      >
        <span class="flex h-2 w-2 rounded-full bg-cyan-400 mr-2 animate-pulse"
        ></span>
        ZZULI Open Source Community
      </div>

      <div
        in:fly={{ y: 20, duration: 800, delay: 500 }}
        class="flex justify-center mb-4"
      >
        <img
          src="https://image.dogxi.me/i/2025/12/16/zzuli.png.webp"
          alt="zzuli logo"
          class="h-24 md:h-32 opacity-90 hover:opacity-100 transition-all duration-500 drop-shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:drop-shadow-[0_0_30px_rgba(6,182,212,0.4)]"
        />
      </div>

      <h1
        in:fly={{ y: 20, duration: 800, delay: 300 }}
        class="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6"
      >
        Code the <span
          class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500"
          >Future</span
        >
      </h1>

      <p
        in:fly={{ y: 20, duration: 800, delay: 400 }}
        class="max-w-2xl mx-auto text-xl text-slate-400 mb-10"
      >
        Building, sharing, and growing together.
        <br />
        构建，共享，成长
      </p>

      <!-- ZZULI Logo -->
      <!-- <div
        in:fly={{ y: 20, duration: 800, delay: 500 }}
        class="flex justify-center mt-8"
      >
        <img
          src="https://image.dogxi.me/i/2025/12/16/zzuli.png.webp"
          alt="zzuli logo"
          class="h-24 md:h-32 opacity-90 hover:opacity-100 transition-all duration-500 drop-shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:drop-shadow-[0_0_30px_rgba(6,182,212,0.4)]"
        />
      </div> -->
    </div>
  </section>

  <!-- Avatar Wall -->
  <div class="mb-20">
    <AvatarWall alumni={data.alumni} />
  </div>

  <div
    class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20"
  >
    <!-- Left Column: Live Activity Feed -->
    <div class="lg:col-span-1 space-y-8">
      <div class="sticky top-8">
        <h2 class="text-xl font-bold text-white mb-6 flex items-center">
          <svg
            class="w-5 h-5 mr-2 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            ></path></svg
          >
          Community Pulse
        </h2>

        <div class="glass-card rounded-xl p-1 overflow-hidden min-h-[400px]">
          {#if loadingActivities}
            <div class="flex items-center justify-center h-64 text-slate-500">
              <svg class="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"
                ><!-- ... --></svg
              >
              Syncing with GitHub...
            </div>
          {:else if activities.length === 0}
            <div class="p-6 text-center text-slate-500">
              No recent public activity found.
            </div>
          {:else}
            <div class="relative">
              <!-- Vertical Line -->
              <div
                class="absolute left-6 top-4 bottom-4 w-px bg-slate-700/50"
              ></div>

              <div class="space-y-0">
                {#each activities as activity, i}
                  <div
                    in:slide|local={{ duration: 300, delay: i * 50 }}
                    class="relative pl-12 pr-4 py-4 hover:bg-slate-800/30 transition-colors border-b border-slate-800/50 last:border-0 group"
                  >
                    <!-- Dot -->
                    <div
                      class="absolute left-[21px] top-6 w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-cyan-400 group-hover:scale-150 transition-all ring-4 ring-slate-900"
                    ></div>

                    <div class="flex items-start justify-between">
                      <div class="flex-1 min-w-0">
                        <p class="text-sm text-slate-300">
                          <span
                            class="font-semibold text-white hover:underline cursor-pointer"
                            >{activity.user}</span
                          >
                          <span class="text-slate-500"
                            >{formatEventType(activity.type)}</span
                          >
                        </p>
                        <a
                          href={activity.url}
                          target="_blank"
                          class="text-xs font-mono text-cyan-400 hover:text-cyan-300 truncate block mt-0.5"
                        >
                          {activity.repo}
                        </a>
                      </div>
                      <span
                        class="text-[10px] text-slate-600 whitespace-nowrap ml-2"
                        >{formatTime(activity.date)}</span
                      >
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Featured Projects Mini List -->
        <div class="mt-8">
          <h2 class="text-xl font-bold text-white mb-6 flex items-center">
            <svg
              class="w-5 h-5 mr-2 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              ></path></svg
            >
            Spotlight
          </h2>
          <div class="space-y-4">
            {#each data.projects.slice(0, 3) as project}
              <a
                href={project.url}
                target="_blank"
                class="block glass-card p-4 rounded-lg hover:border-yellow-500/30 transition-all group"
              >
                <h3
                  class="font-semibold text-white group-hover:text-yellow-400 transition-colors"
                >
                  {project.name}
                </h3>
                <p class="text-xs text-slate-500 mt-1 line-clamp-2">
                  {project.description}
                </p>
              </a>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column: Wall of Fame -->
    <div class="lg:col-span-2">
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4"
      >
        <h2 class="text-2xl font-bold text-white">Wall of Fame</h2>

        <!-- Search -->
        <div class="relative">
          <input
            type="text"
            bind:value={searchTerm}
            placeholder="Find a developer..."
            class="bg-slate-800/50 border border-slate-700 text-white text-sm rounded-full px-4 py-2 pl-10 focus:outline-none focus:border-cyan-500 w-full sm:w-64 transition-all"
          />
          <svg
            class="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path></svg
          >
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {#each filteredAlumni as person}
          <div
            class="glass-card p-4 rounded-xl flex flex-col items-center text-center hover:scale-105 transition-transform duration-300 group relative overflow-hidden"
          >
            <!-- Hover Gradient Background -->
            <div
              class="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            ></div>

            <div class="relative mb-3">
              {#if person.avatar}
                <img
                  src={person.avatar}
                  alt={person.nickname}
                  class="w-16 h-16 rounded-full border-2 border-slate-700 group-hover:border-cyan-400 transition-all shadow-lg object-cover bg-slate-800"
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  onerror={(e) => {
                    const target = e.currentTarget as HTMLImageElement
                    if (target) {
                      target.style.display = 'none'
                      const fallback =
                        target.parentElement?.querySelector('.fallback-avatar')
                      if (fallback) {
                        fallback.classList.remove('hidden')
                        fallback.classList.add('flex')
                      }
                    }
                  }}
                />
                <div
                  class="hidden fallback-avatar absolute inset-0 items-center justify-center w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 text-xl font-bold text-slate-400 group-hover:border-cyan-400 group-hover:text-white transition-all shadow-lg"
                >
                  {person.nickname.charAt(0).toUpperCase()}
                </div>
              {:else}
                <div
                  class="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-xl font-bold text-slate-400 group-hover:border-cyan-400 group-hover:text-white transition-all shadow-lg"
                >
                  {person.nickname.charAt(0).toUpperCase()}
                </div>
              {/if}

              {#if person.github}
                <div
                  class="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-1 border border-slate-700"
                >
                  <svg
                    class="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      fill-rule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clip-rule="evenodd"
                    /></svg
                  >
                </div>
              {/if}
            </div>

            <h3
              class="font-medium text-white truncate w-full px-2 relative z-10"
            >
              {person.nickname}
            </h3>

            <div
              class="flex gap-2 mt-3 opacity-60 group-hover:opacity-100 transition-opacity relative z-10"
            >
              {#if person.github?.url}
                <a
                  href={person.github.url}
                  target="_blank"
                  class="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  title="GitHub"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"
                    ><path
                      fill-rule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clip-rule="evenodd"
                    /></svg
                  >
                </a>
              {/if}
              {#if person.blog?.url}
                <a
                  href={person.blog.url}
                  target="_blank"
                  class="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-indigo-400 transition-colors"
                  title="Blog"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                    ></path></svg
                  >
                </a>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

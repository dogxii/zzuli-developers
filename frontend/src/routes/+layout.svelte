<script lang="ts">
  import '../app.css'
  import favicon from '$lib/assets/favicon.svg'
  import type { Snippet } from 'svelte'

  let { children }: { children: Snippet } = $props()
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="relative min-h-screen flex flex-col">
  <!-- Decorative background elements -->
  <div class="fixed inset-0 z-0 pointer-events-none overflow-hidden">
    <div
      class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[100px]"
    ></div>
    <div
      class="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[100px]"
    ></div>
  </div>

  <main class="relative z-10 flex-grow">
    {@render children()}
  </main>

  <footer class="relative z-10 py-8 border-t border-slate-800/50 mt-auto">
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4"
    >
      <p class="text-slate-600 text-sm">
        &copy; {new Date().getFullYear()} ZZULI Developers.
      </p>
      <div class="flex items-center space-x-6">
        <a
          href="https://github.com/dogxii/zzuli-developers"
          target="_blank"
          class="text-slate-500 hover:text-cyan-400 transition-colors text-sm"
        >
          Contribute on GitHub
        </a>
      </div>
    </div>
  </footer>
</div>

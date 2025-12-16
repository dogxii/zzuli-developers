<script lang="ts">
  interface Alumni {
    nickname: string
    github: { text: string; url: string | null }
    blog: { text: string; url: string | null } | null
    avatar: string | null
  }

  interface Props {
    alumni: Alumni[]
  }

  let { alumni }: Props = $props()

  // Filter alumni with valid avatars
  let validAlumni = $derived(alumni.filter((p) => p.avatar))

  // Create a list long enough to ensure it covers the screen width comfortably.
  // We repeat the list multiple times to ensure the "strip" is wider than any typical screen.
  // If the list is short, we repeat more. If long, 2 times might be enough, but 4 is safe.
  let strip = $derived(Array(4).fill(validAlumni).flat())

  // Handle image load errors
  function handleImageError(event: Event) {
    const img = event.target as HTMLImageElement
    if (img) {
      img.style.display = 'none'
      const parent = img.parentElement
      if (parent) {
        const fallback = parent.querySelector('.fallback-avatar')
        if (fallback) {
          fallback.classList.remove('hidden')
          fallback.classList.add('flex')
        }
      }
    }
  }
</script>

{#if validAlumni.length > 0}
  <div
    class="w-full py-12 overflow-hidden bg-slate-900/30 border-y border-slate-800/50 backdrop-blur-sm relative"
  >
    <!-- Gradient Masks for smooth fade in/out at edges -->
    <div
      class="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#0B1120] to-transparent z-10 pointer-events-none"
    ></div>
    <div
      class="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#0B1120] to-transparent z-10 pointer-events-none"
    ></div>

    <!-- Marquee Container -->
    <div class="flex gap-6 w-max animate-marquee hover-pause">
      <!-- We render the strip twice to create the seamless loop effect.
             The animation moves -50%, which corresponds to exactly one full strip width. -->
      {#each [1, 2] as i}
        <div class="flex gap-6">
          {#each strip as person, index}
            <a
              href={person.github?.url}
              target="_blank"
              rel="noopener noreferrer"
              class="relative block w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border-2 border-slate-700/50 transition-all duration-300 hover:scale-110 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:z-20 bg-slate-800 group"
              title={person.nickname}
            >
              <img
                src={person.avatar}
                alt={person.nickname}
                class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                loading="lazy"
                onerror={handleImageError}
                decoding="async"
                referrerpolicy="no-referrer"
              />
              <div
                class="hidden fallback-avatar absolute inset-0 items-center justify-center text-white text-xl font-bold bg-slate-800"
              >
                {person.nickname.charAt(0).toUpperCase()}
              </div>
              <!-- Hover Overlay Name -->
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1"
              >
                <span
                  class="text-[10px] text-white font-medium truncate px-1 w-full text-center"
                >
                  {person.nickname}
                </span>
              </div>
            </a>
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .animate-marquee {
    animation: marquee 60s linear infinite;
  }

  .hover-pause:hover {
    animation-play-state: paused;
  }

  @keyframes marquee {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }
</style>

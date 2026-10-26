<template>
  <div class="mx-auto max-w-5xl p-3">
    <div class="banner mb-4 border-warning" role="note">
      පාලි පෙළ සෝදුපත් කියවීම තවමත් අවසන් කර නැති බව සලකන්න. අකුරු වැරදි තිබීමට ඉඩ ඇත. පිටු අංක මත එබීමෙන් අදාළ පරිලෝකිත (scan) පිටුව බැලීමට හැකිය.
      අටුවා පරිවර්තනයේ ද පරිවර්තන දෝෂ, මුද්‍රණ දෝෂ හා පරිවර්තන මග හැරුණු තැන් තිබීමට හැකිය. දෝෂ හමු වුවහොත් ඒවා නිවැරදි කිරීමට අප වෙත දන්වා එවන්න. pathnirvana@gmail.com
    </div>
    <h1 class="mb-2 text-xl">ශ්‍රී ලංකා තිපිටක පෙළ, අටුවා සහ සිංහල පරිවර්තනය</h1>
    <p class="mb-4 text-muted">
      තිපිටක පෙළ සහ සිංහල පරිවර්තනය බුද්ධ ජයන්ති තිපිටක ග්‍රන්ථ මාලාවෙනි.
      පාළි අටුවා ඡට්ඨ සංගායනාවෙන් වන අතර එහි සිංහල පරිවර්තනය බෞද්ධ සංස්කෘතික මධ්‍යස්ථානයේ මුද්‍රණයෙනි.
      මෙම වෙබ් අඩවිය සහ මෘදුකාංගය පහත ව්‍යාපෘති හා වෙබ් අඩවි වල සාමුහික ප්‍රයත්නයක ප්‍රතිඵලයකි.
    </p>
    <!-- the projects behind the site: drawn logos take the theme's colours; the pictures keep theirs (only dimmed in the dark theme) -->
    <div class="-mx-1.5 mb-6 flex flex-wrap" data-testid="welcome-logos">
      <div class="w-1/2 p-1.5 sm:w-1/4"><div class="logo-card text-fg"><LogoBuddhaJayanthi /></div></div>
      <div class="w-1/2 p-1.5 sm:w-1/4"><div class="logo-card text-fg"><LogoBoLeaf /></div></div>
      <div class="w-1/2 p-1.5 sm:w-1/4"><div class="logo-card !p-0"><img :src="asset('static/images/thripitakaya.org-logo.jpg')" class="logo-photo w-full" alt="Thripitakaya.org"></div></div>
      <div class="w-1/2 p-1.5 sm:w-1/4"><div class="logo-card"><img :src="asset('static/images/tipitaka.lk-logo.png')" class="logo-photo w-full" alt="tipitaka.lk"></div></div>
    </div>
    <div class="banner mb-4 border-info">අන්තර්ජාලය නැතිව භාවිතා කළ හැකි මෘදුකාංග පහතින් බාගත කරගන්න.</div>
    <div class="-mx-1.5 flex flex-wrap" data-testid="downloads">
      <div v-for="d in downloads" :key="d.name" class="w-1/2 p-1.5 sm:w-1/4">
        <a :href="d.href" target="_blank" rel="noopener" class="flex items-center rounded-lg border border-line bg-surface px-3 py-2 hover:border-primary hover:bg-surface2">
          <component :is="d.icon" class="mr-2.5 shrink-0 text-[28px] text-primary" />
          <span class="min-w-0 leading-tight">
            <span class="block text-xs text-muted">{{ d.from }}</span>
            <span class="block truncate">{{ d.name }}</span>
          </span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue'
import IconAndroid from '~icons/mdi/android'
import IconApple from '~icons/mdi/apple'
import IconWindows from '~icons/mdi/microsoft-windows'
import IconLaptop from '~icons/mdi/laptop'
import LogoBuddhaJayanthi from '@/components/LogoBuddhaJayanthi.vue'
import LogoBoLeaf from '@/components/LogoBoLeaf.vue'
useHead({ title: 'Welcome / පිළිගනිමු' })
const asset = (p: string) => import.meta.env.BASE_URL + p
const downloads = [
  { name: 'Android', from: 'Google Play', icon: IconAndroid, href: 'https://play.google.com/store/apps/details?id=lk.tipitaka.main' },
  { name: 'iPhone / iPad', from: 'App Store', icon: IconApple, href: 'https://apps.apple.com/app/id6615068500' },
  { name: 'Windows', from: 'Microsoft Store', icon: IconWindows, href: 'https://apps.microsoft.com/detail/9NQD7HRP2T9N' },
  { name: 'macOS', from: 'Mac App Store', icon: IconLaptop, href: 'https://apps.apple.com/app/id6615068500' },
]
</script>

<style scoped>
/* square cards: the drawings and the pictures are square (no aspect-ratio: Chrome 53) */
.logo-card { overflow: hidden; border-radius: 0.5rem; border: 1px solid var(--c-line); background: var(--c-surface); padding: 6%; }
.logo-card > svg, .logo-card > img { display: block; width: 100%; height: auto; }
.dark .logo-photo { filter: brightness(0.85) saturate(0.9); }
</style>

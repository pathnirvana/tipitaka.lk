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
    <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
      <img v-for="l in logos" :key="l" :src="asset(l)" class="invert-dark w-full rounded border border-line" alt="">
    </div>
    <div class="banner mb-4 border-info">අන්තර්ජාලය නැතිව භාවිතා කළ හැකි මෘදුකාංග පහතින් බාගත කරගන්න.</div>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
      <a v-for="d in downloads" :key="d.img" :href="d.href" target="_blank" rel="noopener" class="flex justify-center">
        <img :src="asset(d.img)" class="h-10 invert dark:invert-0" alt="">
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue'
useHead({ title: 'Welcome / පිළිගනිමු' })
const asset = (p: string) => import.meta.env.BASE_URL + p
const logos = ['static/images/logo-500x500.png', 'static/images/sltp-logo-mono.jpg', 'static/images/thripitakaya.org-logo-mono.jpg', 'static/images/tipitaka.lk-logo-mono.png']
const releases = 'https://github.com/pathnirvana/tipitaka.lk/releases/'
const downloads = [
  { img: 'static/images/android2.png', href: 'https://play.google.com/store/apps/details?id=lk.tipitaka.main' },
  { img: 'static/images/ios.png', href: 'https://apps.apple.com/us/app/sinhala-tripitaka-atuwa/id6615068500' },
  { img: 'static/images/windows.png', href: releases }, { img: 'static/images/macos2.png', href: releases }, { img: 'static/images/linux.png', href: releases },
]
</script>

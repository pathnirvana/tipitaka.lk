<!-- the home page: what this is and where to start (for readers new to the tipitaka) -->
<template>
  <div class="mx-auto max-w-3xl px-4 pb-16 pt-6" :style="{ fontSize: settings.fontPx }" data-testid="welcome">
    <div class="mb-6 flex items-center">
      <img :src="asset('static/images/icon-192.png')" class="mr-4 h-24 w-24 shrink-0" alt="">
      <div>
        <h1 class="text-[1.5em] font-bold text-primary">{{ SITE_NAME }}</h1>
        <p class="text-muted">බුද්ධ ජයන්ති ත්‍රිපිටකයේ පාළි පාඨය, සැමට තේරුම් ගත හැකි සරල සිංහල පරිවර්තනය සමඟ.</p>
      </div>
    </div>

    <h2 class="mb-2 text-[1.15em] text-primary">කියවීම අරඹන්න</h2>
    <div class="-mx-1.5 mb-6 flex flex-wrap" data-testid="start-links">
      <div v-for="s in starts" :key="s.key" class="w-full p-1.5 sm:w-1/2">
        <RouterLink :to="'/' + s.key" class="card block h-full hover:border-primary">
          <div class="font-bold text-primary">{{ s.name }}</div>
          <div class="text-[0.85em] text-muted">{{ s.desc }}</div>
        </RouterLink>
      </div>
    </div>

    <h2 class="mb-2 text-[1.15em] text-primary">භාවිතා කරන ආකාරය</h2>
    <ul class="mb-6 list-disc space-y-1.5 pl-5">
      <li>වම් පස <IconMenu class="inline" /> බොත්තමෙන් සියලු සූත්‍ර ඇති නාමාවලිය විවෘත වේ.</li>
      <li>ඉහළ සෙවුම් කොටුවෙන් සූත්‍ර නාම, සූත්‍ර අන්තර්ගතය සහ පාළි වචන සොයන්න. සිංග්ලිෂ් (singlish) අකුරෙන්ද සෙවිය හැක.</li>
      <li>කියවන ආකාරය තෝරන්න: සිංහල පමණක්, පාළි පමණක්, හෝ පාළිය සමඟ.</li>
      <li>පාළි වචනයක් එබූ විට එහි තේරුම ශබ්දකෝෂයෙන් පෙන්වේ.</li>
      <li>බොහෝ සූත්‍රවලට සජ්ඣායනා (chanting) ඇත.</li>
    </ul>
    <RouterLink to="/help" class="btn">විස්තරාත්මක උපදෙස් / Help</RouterLink>
    <p class="mt-6 text-[0.85em] text-muted">
      සරල සිංහල පරිවර්තනය දැනට සූත්‍ර පිටකයේ දීඝ, මජ්ඣිම, සංයුත්ත සහ අඞ්ගුත්තර නිකාය සහ ඛුද්දක නිකායේ බොහෝ ග්‍රන්ථ සඳහා ඇත.
      විනය සහ අභිධර්ම පිටක වල පාළි පාඨය පමණක් ඇත.
    </p>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue'
import IconMenu from '~icons/mdi/menu'
import { useSettings } from '@/stores/settings'
import { SITE_NAME } from '@p/site'

useHead({ title: 'මුල් පිටුව / Home' })
const settings = useSettings()
const asset = (p: string) => import.meta.env.BASE_URL + p
const starts = [
  { key: 'dn', name: 'දීඝ නිකාය', desc: 'දිගු සූත්‍ර 34 - බ්‍රහ්මජාල, සාමඤ්ඤඵල, මහාපරිනිබ්බාන ආදිය' },
  { key: 'mn', name: 'මජ්ඣිම නිකාය', desc: 'මධ්‍යම ප්‍රමාණයේ සූත්‍ර 152' },
  { key: 'sn', name: 'සංයුත්ත නිකාය', desc: 'මාතෘකා අනුව සංග්‍රහ කළ සූත්‍ර' },
  { key: 'an', name: 'අඞ්ගුත්තර නිකාය', desc: 'අංක අනුව සංග්‍රහ කළ සූත්‍ර' },
  { key: 'kn-dhp', name: 'ධම්මපදය', desc: 'ගාථා 423 - ආරම්භ කිරීමට හොඳම තැන' },
  { key: 'kn-khp', name: 'ඛුද්දකපාඨය', desc: 'මංගල, රතන, කරණීය මෙත්ත සූත්‍ර ආදිය' },
]
</script>

<template>
  <v-sheet>
    <v-dialog v-model="$store.state.androidBusy" persistent>
      <v-card>
        <div class="d-flex flex-no-wrap justify-space-around align-center">
          <div class="ml-3"><v-progress-circular size="50" indeterminate color="primary"></v-progress-circular></div> 
          <div>
            <v-card-text>මෙම මෘදුකාංගයේ දත්ත පිටපත් වෙමින් පවතී. මොහොතක් රැඳී සිටින්න. මෙය පළමු ස්ථාපනයේ දී පමණක් සිදුවේ.</v-card-text>
          </div>
        </div>
      </v-card>
    </v-dialog>

    <v-banner icon="mdi-alert-circle" color="warning">
      පාලි පෙළ සෝදුපත් කියවීම තවමත් අවසන් කර නැති බව සලකන්න. අකුරු වැරදි තිබීමට ඉඩ ඇත. පිටු අංක මත එබීමෙන් අදාළ පරිලෝකිත (scan) පිටුව බැලීමට හැකිය.
      අටුවා පරිවර්තනයේ ද පරිවර්තන දෝෂ, මුද්‍රණ දෝෂ හා පරිවර්තන මග හැරුණු තැන් තිබීමට හැකිය. දෝෂ හමු වුවහොත් ඒවා නිවැරදි කිරීමට අප වෙත දන්වා එවන්න. pathnirvana@gmail.com
    </v-banner>

    <v-container fluid>
      <v-row>
        <v-col cols="12">
          <v-card flat>
            <v-card-title>ශ්‍රී ලංකා තිපිටක පෙළ, අටුවා සහ සිංහල පරිවර්තනය</v-card-title>
            <v-card-text>
              තිපිටක පෙළ සහ සිංහල පරිවර්තනය බුද්ධ ජයන්ති තිපිටක ග්‍රන්ථ මාලාවෙනි. 
              පාළි අටුවා ඡට්ඨ සංගායනාවෙන් වන අතර එහි සිංහල පරිවර්තනය බෞද්ධ සංස්කෘතික මධ්‍යස්ථානයේ මුද්‍රණයෙනි. 
              මෙම වෙබ් අඩවිය සහ මෘදුකාංගය පහත ව්‍යාපෘති හා වෙබ් අඩවි වල සාමුහික ප්‍රයත්නයක ප්‍රතිඵලයකි.
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="contrib-logos">
        <v-col cols="6" sm="3" xl="2">
          <v-card outlined class="d-flex">
            <img src="static/images/logo-500x500.png" width="100%">
          </v-card>
        </v-col>

        <v-col cols="6" sm="3" xl="2">
          <v-card outlined class="d-flex">
            <img src="static/images/sltp-logo-mono.jpg" width="100%">
          </v-card>
        </v-col>

        <v-col cols="6" sm="3" xl="2">
          <v-card flat tile class="d-flex">
            <img src="static/images/thripitakaya.org-logo-mono.jpg" width="100%">
          </v-card>
        </v-col>

        <v-col cols="6" sm="3" xl="2">
          <v-card outlined class="d-flex">
            <img src="static/images/tipitaka.lk-logo-mono.png" width="100%">
          </v-card>
        </v-col>

      </v-row>
        
      <v-row v-if="!isIOS">
        <v-col cols="12">
          <v-banner icon="mdi-information" color="info">
            අන්තර්ජාලය නැතිව භාවිතා කළ හැකි මෘදුකාංග පහතින් බාගත කරගන්න.
          </v-banner>
        </v-col>
      </v-row>
      <v-row class="download-software-list" v-if="!isIOS">
        <v-col cols="6" sm="3" xl="2">
          <v-row justify="center">
            <a href="https://play.google.com/store/apps/details?id=lk.tipitaka.main" target="_blank"><img src="static/images/android2.png"></a>
          </v-row>
        </v-col>
        <v-col cols="6" sm="3" xl="2">
          <v-row justify="center">
            <a href="https://github.com/pathnirvana/tipitaka.lk/releases/" target="_blank"><img src="static/images/windows.png"></a>
          </v-row>
        </v-col>
        <v-col cols="6" sm="3" xl="2">
          <v-row justify="center">
            <a href="https://github.com/pathnirvana/tipitaka.lk/releases/" target="_blank"><img src="static/images/macos2.png"></a>
          </v-row>
        </v-col>
        <v-col cols="6" sm="3" xl="2">
          <v-row justify="center">
            <a href="https://github.com/pathnirvana/tipitaka.lk/releases/" target="_blank"><img src="static/images/linux.png"></a>
          </v-row>
        </v-col>
      </v-row>
    </v-container>
    
  </v-sheet>
</template>

<style scoped>
.theme--dark .contrib-logos img { filter: invert(90%); }
.download-software-list img { height: 40px; filter: invert(95%); margin: 2px; }
.theme--dark .download-software-list img { filter: invert(12%); }
</style>

<script>
import { IOS, platform } from '../constants';

export default {
  metaInfo: {
    title: 'Welcome / පිළිගනිමු',
  },
  computed: {
      isIOS() {
      return platform === IOS;
    }
  }
}
</script>

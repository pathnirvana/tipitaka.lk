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
      පාලි පෙළ සෝදුපත් කියවීම තවමත් අවසන් කර නැති බව සලකන්න. අකුරු වැරදි තිබීමට ඉඩ ඇත. පිටු අංක මත එබීමෙන් අදාළ පරිලෝකිත පිටුව බැලීමට හැකිය.
      අටුවා පරිවර්තනයේ ද පරිවර්තන දෝෂ, මුද්‍රණ දෝෂ හා පරිවර්තන මග හැරුණු තැන් තිබීමට හැකිය. දෝෂ හමු වුවහොත් ඒවා නිවැරදි කිරීමට අප වෙත දන්වා එවන්න. pathnirvana@gmail.com
    </v-banner>

    <v-container fluid>
      <v-row>
        <v-col cols="12">
          <v-card flat>
            <v-card-title>ත්‍රිපිටක පෙළ, අටුවා සහ සිංහල පරිවර්තනය</v-card-title>
            <v-card-text>
              ත්‍රිපිටක පෙළ සහ සිංහල පරිවර්තනය බුද්ධ ජයන්ති ත්‍රිපිටක ග්‍රන්ථ මාලාවෙනි. 
              පාළි අටුවා ඡට්ඨ සංගායනාවෙන් ද එහි සිංහල පරිවර්තනය බෞද්ධ සංස්කෘතික මධ්‍යස්ථානයේ මුද්‍රණයෙනි. 
              මෙම වියමන අඩවිය සහ මෘදුකාංගය පහත ව්‍යාපෘති හා අඩවි වල සාමුහික ප්‍රයත්නයක ප්‍රතිඵලයකි.
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="contrib-logos">
        <v-col cols="6" sm="3" xl="2">
          <v-card outlined class="d-flex">
            <img src="static/images/logo-500x500.png" width="100%">
            <!-- <v-img src="static/images/logo-500x500.png"
              lazy-src="data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADH0lEQVRYR8WXWaiNURTHf9ecIUTGMpWESBlTxghJ8eBB8naj8MCDoihFFC8eROFFUsqDFElkThmSJ0IZMxOSeex/2+u27Lv3951zPNxdp/Odvdf+r/+av1NHM6+6ZtZPLQT+ACuAXcAxYC7UhNNgey0EdO8Z0KfAe/uBpcC3Mg9XQkAWS25PABXmKOBmAN8MrE8oug8M+l8CUm6eegT0jwA7AR8zSqYBZ4FVwI4ckSIPjAWuAZuADQGgA/CpzCp3LgMeAnuBLal7OQIngaHACWBZFQpNtB7Y57wnIsKaE2PlCJwDpgbhO8CQBAkfHj3PB45myEqPZNoDn71MjsADYGAQtFDYPUvKmMBuYDnwHOidIHIRGA509dWXIqDyelpQorFis86+4/LuArwHeoV8aFtGwMivBHZGCWWEvRdiArGMIPoBj4GfQKtKQiCZH0DriIB+DgZeuPKTwnbAl2BZG9eAvIeXAAcqTULJTQfOhAstgN/hWdarFDtGYEowK9FFwKFKqqeoDywAjjilhicylgfjgCuJfLHzOB+acMoRKOr144NSD3YQWOyI6eweMAtQRWkpTF+rCYHJqhzV14ty5yXQ0xFQ690IfCgLQ1EINGaPRyEweTUTxVzrAjDZKeoOvHa/Cwde0eFM4FRkge8B24E17lz1bS42XO0VjuRKxrF0/AKUfJZUvg+obWvy2Z6qxXBjfMnMBjRrGsG8kaeBGW6jG/DWhUGApsAa0ETgMrAO2BqUK/YKzbzIg9YVG7dTHtB8V89W54rXFEAW+7ZrAybXitX73zkg81TSA9o0AZ9onkhuGInADWAC8D1BXvuXgBHA7VwIUopuAcMSgBrXeuOxsFiOJEQb4r4NGBlyybpq9qVUrj4fkq9lCrFkbyFw2OWZpqvKU3Pin1VUBXK1Pt6y68CYKgnJ2qx3Ki1D6VTfvxopl2V9M4REXuUm92dXNQQkezeM6AEO0ff4HsCrcKYGpDM/mJoQqYbAJOANoKRUY1K56qXlSah5Ax8d/jNIpnRVQ8CD6Y+JJqCUrQVWA51LtSUEaiVQi67knWYn8Bc/EaYhj0wfFwAAAABJRU5ErkJggg=="
              aspect-ratio="1"
              class="white">
              <template v-slot:placeholder>
                <v-row class="fill-height ma-0" align="center" justify="center">
                  <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                </v-row>
              </template>
            </v-img> -->
          </v-card>
        </v-col>

        <v-col cols="6" sm="3" xl="2">
          <v-card outlined class="d-flex">
            <img src="static/images/sltp-logo-mono.jpg" width="100%">
            <!-- <v-img src="static/images/sltp-logo.jpg"
              lazy-src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAfACADASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAACAcJBv/EACcQAAICAQMEAwACAwAAAAAAAAECAwQFBhESAAcTIQgiMRVTYXHw/8QAFgEBAQEAAAAAAAAAAAAAAAAABQMG/8QAKBEAAQMCBAUFAQAAAAAAAAAAAQIDEQQxAAUSIQYiUWGxEyNBcYHR/9oADAMBAAIRAxEAPwDUvoy98PkFqPSveil2qq3v4WlLQguLOkavPdd2fcK324oOHHbirFg36pHSNzWbw+nMXZzefydXHY+mnkns2ZRHHGu+27MfQ9kD/JIHWO/y6+RXZXuH3+sas0Vc1HnUgVYHGXL06de1X2EUlQh/KYj9maORYvsx2P3+gOa07tXSrZYUUqIum/keRhjJn2aWqS9UpCkW5ht4O4uNjjVztprIZ+OxirWZiyFqpHDKJgAjsrqTxZQB7GwO+w3DD/Z7noHdlPkLo/RVrDahg0rQuwZzETz2rGJaHyrM7RtyJ5/YPIG332O5Zv0cOlj2k7x4PuxjZpatR8bkqjHz0ZZQ5Cb7CRGAHNd/ROwIPojYqWJ4fzRLjCaWpX7skQZkgdzfpeTE74Wz7h+ppga9ls+gYOoRAJ7D+ACfrEL+eOt0r4/B9v2y9ajWsb5TIeefxCRASkS+yAw5eRuPv2qnb0Oh/Y+PenNT5vS9yfT1y+dR4XKX66TVGjWZqNOK2/GIkNMr+VY45F25En1xHVl+aqDUHcyxk1kEbY/IUsSokiBCwMnGRvrs+/ldSCGHrb1+9H+vp/Vleb+WwMFGSzXv8K9bxCcWI/EPIZmlkjKKOUnFw0jlo13Xi52kt9Ljrj5cFyBz6Y0kiD93/Zxp6OncYomKQMkgBKj7XqSVgKCh8QNx+EHHSaQzOjbGZuaV0jmcXNPj7E1K1GjvCsM8SWCIlWYJJIGWnIA0asi7xBihdV6S3xgytnE9yMVFK/jTJJPVlU7+laLyKvo/2Kv/AHvqQae7Fd6td6azWT0hiKF2I2ZOMcs8UEqBQzxR8jIF2+sajZfyT22/JurboDQGte3fcvQEOsqsMM94rLOI5EbxzmGIGP6s3ICTzgMCAVCkj36Dfy5aXWMwpwAgLTJK9U8yRtsOpBww7nzT9JUZRUr1OFCoSG9GmEqO41KiwPXtj//Z"
              aspect-ratio="1"
              class="grey lighten-2">
              <template v-slot:placeholder>
                <v-row class="fill-height ma-0" align="center" justify="center">
                  <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                </v-row>
              </template>
            </v-img> -->
          </v-card>
        </v-col>

        <v-col cols="6" sm="3" xl="2">
          <v-card flat tile class="d-flex">
            <img src="static/images/thripitakaya.org-logo-mono.jpg" width="100%">
            <!-- <v-img src="static/images/thripitakaya.org-logo.jpg"
              lazy-src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAgACADASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAABAYAAwcF/8QAKBAAAgICAQMDBAMBAAAAAAAAAQIDBAUREgYTIQAiIxQxMkEHFSVR/8QAGAEAAwEBAAAAAAAAAAAAAAAAAgQFBwj/xAApEQACAQMCBAUFAAAAAAAAAAABAhEAAyESMQRBUWEFE1JxoZGx0eHw/9oADAMBAAIRAxEAPwB+emsha31LkaU0tNhHApRok5EK7jtiQqSACV2SVB/Q5cu30bhHzeOV8R/nUa0qzfMJCO0pckKFeNUbwnkb1sjRHrOv5BvZXNYizV6ax01Cy9gSirHQlFufkdBirxgsG4BT4JCqASNEB46czuU6Zq3ls4rOW8ZkmeOqaFEzWIRzZlfsMnc5cWH3U64+7RJHrlNeFAZTdEySI6Y6RG5+9b+xe4h0NkR2/sUX1hhLMleWG/NHbtxLK9WXcZjmU78HuM2mUMya3+mI4huIExeDgiqwRRyu6cdszj5ZCNeC2xv8T9vsdeDoaZMhdfIUsZl4beUmix0RW4JK8UslkpKgld0Ee1ZTyf49aI8KfxN9+tXx1xUaeYpskaXzwY+NcQD+R/6djW9+mL1sKC1ppH596WBYgKwg5+KdcYuAwGCa41FU7FZZTMSoMshB0gaQjZJ8e4rvY87DaJrWOWPhmxOEa21qFX7kUiNChYfk7niCD4IK7JH6Gxtfzoj/AK2qMLv6psdZFjR0wt/P2SC+114gBGtEE/Y7Pqx68MeNsSR5GGS61usY4zG/AVRFIZQDoak5tGCTyX4wFABZzateIq6htNvTpOPMAMwD6dzMDuGk4qLctEMRLzPpJESe+2J9iMUba6ayWUBr5NKqTfTkyTU5WjJBYgsGC8uQUcgOS+TrZ1yGYZ7PWul+pW6QzmRuXJIoa1qpZtJXTvRPI22kCLGI22rqfCjSn4zr3aZ03i8IFxCdUdZF2sxcriw4qRGr8Y/dzcF0Ls/HQQEe862I+TzMVsPDDVGGybT2IUlN5WjYxzHnAI2gYqmhqWQsrjl8T68KC48SqmyzqtvaYF5SeR2iTg/B6EUVjiCrhDq6ZQgfXl+xX//Z"
              aspect-ratio="1"
              class="grey lighten-2">
              <template v-slot:placeholder>
                <v-row class="fill-height ma-0" align="center" justify="center">
                  <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                </v-row>
              </template>
            </v-img> -->
          </v-card>
        </v-col>

        <v-col cols="6" sm="3" xl="2">
          <v-card outlined class="d-flex">
            <img src="static/images/tipitaka.lk-logo-mono.png" width="100%">
            <!-- <v-img src="static/images/pitaka.lk-logo.jpg"
              lazy-src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAgACADASIAAhEBAxEB/8QAGQAAAwADAAAAAAAAAAAAAAAABAUGAgMJ/8QAJRAAAgICAgICAgMBAAAAAAAAAgMBBAUGERITIQciM0EUFjEj/8QAGAEBAAMBAAAAAAAAAAAAAAAAAgEDBQb/xAAnEQEAAgEDAgYCAwAAAAAAAAABAhEhAwQxAEEFEhMiIzIVsSRRYf/aAAwDAQACEQMRAD8A6V7huFrAWsfiMTiCyOQyRFAjBxAoCI/Iz99effvrHAn9omIggZ0q1l5anbc5ZyKnt4bVEpFMwBgSi6+hiJFc9ogZ4k46lEhJlI5bYKNao7brm65XAU87kiqV8xSiuBIUKmnBMRbSQEoFpEiaIsJYwZH4lrsMjL422vNbHgV7rlNryt9DsbSzNvHRp7q9RVR9QnKXj4CDY1/tUs62LcQQmAguWBAc5p+TxKRq7j3RlmMb9pHspdSZGcjV0d3rTmu1+PSwnL3v+jGAcY55erAdKZiVor6nmrmOGu4+iJZJJ6sIiOenseBg46xIxzI+57FBwTp+4XM9cv4fMYZmNyGOkeYkokLATH5F/uR59+uR4IPtM9hGX275e1vGaDtGc1DLY+9lMNgstk6tV4n1YVJIHMmH1KVz56pRMTEMU9RgUgYlK/DbHnnYLDbDsN0bR6y5WJyeZUEkORvpk0ZM11wTHiSLlsATnpJkJxC+sINi1HT8PfW22ImZRPqxwLV1FiZsq6pynUQZbr49XK8Pe/2i4zxyd+tpahhbrH67cxWXA8LdFVAsXk7tS2ms9wCzm5XbBimVyhkomREpr9y7kMytrR0j4zpw+lU0dh4u68Vfw3VGHjkG1LlGSKjP+SBYDmg00qEWfyC7yXJzD7cNOtZ+5jsxiMuWOyGNMiiYCJCwEx+Jk/71mY4/cdSP6zMiQhTul3EEx22YK1RWlvJ2QCSVEGYAoefsM9RYXaYKOZDkR5PxiIH4+Xo7hIwPrJCkLS0KihQj9quOV6cv5R6mmXJ5LzeO3cXJXF09RuK1H44G9dNnx/szwmH17FnKNyF0rqTX4m+aLBlLgNfoxbJdhq1IkSJNcFvspqOpIuxQwul1cdZ2fKE7LMrICk2742HJtcapEn8xLTjt2mPJBciXWJb/ANzsZZaX6lhbd7zPPq5ipFPRZEJx25gfvAcDMlPWS5IeweMi9Q1C5gbmQzGXzB5G/kSifY8BWD/fEvn315nj11jgQ+sTBEVcIS3o7fSkTjL7SIhEjyg1UlMYurt/1SY7dNWUfKnBeV/YDnPPB1//2Q=="
              aspect-ratio="1"
              class="grey lighten-2">
              <template v-slot:placeholder>
                <v-row class="fill-height ma-0" align="center" justify="center">
                  <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                </v-row>
              </template>
            </v-img> -->
          </v-card>
        </v-col>

      </v-row>
        
      <v-row>
        <v-col cols="12">
          <v-banner icon="mdi-information" color="info">
            අන්තර්ජාලය නැතිව භාවිතා ක හැකි මෘදුකාංග පහතින් බාගන්න. අටුවා සහ iOS මෘදුකාංග ළඟදීම බලාපොරොත්තු වන්න.
          </v-banner>
        </v-col>
      </v-row>
      <v-row class="download-software-list">
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
export default {
  metaInfo: {
    title: 'Welcome / පිළිගනිමු',
  },
}
</script>
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
      පාලි පෙළ සෝදුපත් කියවීම තවමත් අවසන් කර නැති බව සලකන්න. අකුරු වැරදි තිබීමට ඉඩ ඇත. පිටු අංක මත එබීමෙන් අදාළ පරිලෝකිත පිටුව බැලීමට හැකිය.
      අටුවා පරිවර්තනයේ ද පරිවර්තන දෝෂ, මුද්‍රණ දෝෂ හා පරිවර්තන මග හැරුණු තැන් තිබීමට හැකිය. දෝෂ හමු වුවහොත් ඒවා නිවැරදි කිරීමට අප වෙත දන්වා එවන්න. pathnirvana@gmail.com
    </v-banner>

    <v-container fluid>
      <v-row>
        <v-col cols="12">
          <v-card flat>
            <v-card-title>ත්‍රිපිටක පෙළ, අටුවා සහ සිංහල පරිවර්තනය</v-card-title>
            <v-card-text>
              ත්‍රිපිටක පෙළ සහ සිංහල පරිවර්තනය බුද්ධ ජයන්ති ත්‍රිපිටක ග්‍රන්ථ මාලාවෙනි. 
              පාළි අටුවා ඡට්ඨ සංගායනාවෙන් ද එහි සිංහල පරිවර්තනය බෞද්ධ සංස්කෘතික මධ්‍යස්ථානයේ මුද්‍රණයෙනි. 
              මෙම වියමන අඩවිය සහ මෘදුකාංගය පහත ව්‍යාපෘති හා අඩවි වල සාමුහික ප්‍රයත්නයක ප්‍රතිඵලයකි.
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="contrib-logos">
        <v-col cols="6" sm="3" xl="2">
          <v-card outlined class="d-flex">
            <img src="static/images/logo-500x500.png" width="100%">
            <!-- <v-img src="static/images/logo-500x500.png"
              lazy-src="data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADH0lEQVRYR8WXWaiNURTHf9ecIUTGMpWESBlTxghJ8eBB8naj8MCDoihFFC8eROFFUsqDFElkThmSJ0IZMxOSeex/2+u27Lv3951zPNxdp/Odvdf+r/+av1NHM6+6ZtZPLQT+ACuAXcAxYC7UhNNgey0EdO8Z0KfAe/uBpcC3Mg9XQkAWS25PABXmKOBmAN8MrE8oug8M+l8CUm6eegT0jwA7AR8zSqYBZ4FVwI4ckSIPjAWuAZuADQGgA/CpzCp3LgMeAnuBLal7OQIngaHACWBZFQpNtB7Y57wnIsKaE2PlCJwDpgbhO8CQBAkfHj3PB45myEqPZNoDn71MjsADYGAQtFDYPUvKmMBuYDnwHOidIHIRGA509dWXIqDyelpQorFis86+4/LuArwHeoV8aFtGwMivBHZGCWWEvRdiArGMIPoBj4GfQKtKQiCZH0DriIB+DgZeuPKTwnbAl2BZG9eAvIeXAAcqTULJTQfOhAstgN/hWdarFDtGYEowK9FFwKFKqqeoDywAjjilhicylgfjgCuJfLHzOB+acMoRKOr144NSD3YQWOyI6eweMAtQRWkpTF+rCYHJqhzV14ty5yXQ0xFQ690IfCgLQ1EINGaPRyEweTUTxVzrAjDZKeoOvHa/Cwde0eFM4FRkge8B24E17lz1bS42XO0VjuRKxrF0/AKUfJZUvg+obWvy2Z6qxXBjfMnMBjRrGsG8kaeBGW6jG/DWhUGApsAa0ETgMrAO2BqUK/YKzbzIg9YVG7dTHtB8V89W54rXFEAW+7ZrAybXitX73zkg81TSA9o0AZ9onkhuGInADWAC8D1BXvuXgBHA7VwIUopuAcMSgBrXeuOxsFiOJEQb4r4NGBlyybpq9qVUrj4fkq9lCrFkbyFw2OWZpqvKU3Pin1VUBXK1Pt6y68CYKgnJ2qx3Ki1D6VTfvxopl2V9M4REXuUm92dXNQQkezeM6AEO0ff4HsCrcKYGpDM/mJoQqYbAJOANoKRUY1K56qXlSah5Ax8d/jNIpnRVQ8CD6Y+JJqCUrQVWA51LtSUEaiVQi67knWYn8Bc/EaYhj0wfFwAAAABJRU5ErkJggg=="
              aspect-ratio="1"
              class="white">
              <template v-slot:placeholder>
                <v-row class="fill-height ma-0" align="center" justify="center">
                  <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                </v-row>
              </template>
            </v-img> -->
          </v-card>
        </v-col>

        <v-col cols="6" sm="3" xl="2">
          <v-card outlined class="d-flex">
            <img src="static/images/sltp-logo-mono.jpg" width="100%">
            <!-- <v-img src="static/images/sltp-logo.jpg"
              lazy-src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAfACADASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAACAcJBv/EACcQAAICAQMEAwACAwAAAAAAAAECAwQFBhESAAcTIQgiMRVTYXHw/8QAFgEBAQEAAAAAAAAAAAAAAAAABQMG/8QAKBEAAQMCBAUFAQAAAAAAAAAAAQIDEQQxAAUSIQYiUWGxEyNBcYHR/9oADAMBAAIRAxEAPwDUvoy98PkFqPSveil2qq3v4WlLQguLOkavPdd2fcK324oOHHbirFg36pHSNzWbw+nMXZzefydXHY+mnkns2ZRHHGu+27MfQ9kD/JIHWO/y6+RXZXuH3+sas0Vc1HnUgVYHGXL06de1X2EUlQh/KYj9maORYvsx2P3+gOa07tXSrZYUUqIum/keRhjJn2aWqS9UpCkW5ht4O4uNjjVztprIZ+OxirWZiyFqpHDKJgAjsrqTxZQB7GwO+w3DD/Z7noHdlPkLo/RVrDahg0rQuwZzETz2rGJaHyrM7RtyJ5/YPIG332O5Zv0cOlj2k7x4PuxjZpatR8bkqjHz0ZZQ5Cb7CRGAHNd/ROwIPojYqWJ4fzRLjCaWpX7skQZkgdzfpeTE74Wz7h+ppga9ls+gYOoRAJ7D+ACfrEL+eOt0r4/B9v2y9ajWsb5TIeefxCRASkS+yAw5eRuPv2qnb0Oh/Y+PenNT5vS9yfT1y+dR4XKX66TVGjWZqNOK2/GIkNMr+VY45F25En1xHVl+aqDUHcyxk1kEbY/IUsSokiBCwMnGRvrs+/ldSCGHrb1+9H+vp/Vleb+WwMFGSzXv8K9bxCcWI/EPIZmlkjKKOUnFw0jlo13Xi52kt9Ljrj5cFyBz6Y0kiD93/Zxp6OncYomKQMkgBKj7XqSVgKCh8QNx+EHHSaQzOjbGZuaV0jmcXNPj7E1K1GjvCsM8SWCIlWYJJIGWnIA0asi7xBihdV6S3xgytnE9yMVFK/jTJJPVlU7+laLyKvo/2Kv/AHvqQae7Fd6td6azWT0hiKF2I2ZOMcs8UEqBQzxR8jIF2+sajZfyT22/JurboDQGte3fcvQEOsqsMM94rLOI5EbxzmGIGP6s3ICTzgMCAVCkj36Dfy5aXWMwpwAgLTJK9U8yRtsOpBww7nzT9JUZRUr1OFCoSG9GmEqO41KiwPXtj//Z"
              aspect-ratio="1"
              class="grey lighten-2">
              <template v-slot:placeholder>
                <v-row class="fill-height ma-0" align="center" justify="center">
                  <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                </v-row>
              </template>
            </v-img> -->
          </v-card>
        </v-col>

        <v-col cols="6" sm="3" xl="2">
          <v-card flat tile class="d-flex">
            <img src="static/images/thripitakaya.org-logo-mono.jpg" width="100%">
            <!-- <v-img src="static/images/thripitakaya.org-logo.jpg"
              lazy-src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAgACADASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAABAYAAwcF/8QAKBAAAgICAQMDBAMBAAAAAAAAAQIDBAUREgYTIQAiIxQxMkEHFSVR/8QAGAEAAwEBAAAAAAAAAAAAAAAAAgQFBwj/xAApEQACAQMCBAUFAAAAAAAAAAABAhEAAyESMQRBUWEFE1JxoZGx0eHw/9oADAMBAAIRAxEAPwB+emsha31LkaU0tNhHApRok5EK7jtiQqSACV2SVB/Q5cu30bhHzeOV8R/nUa0qzfMJCO0pckKFeNUbwnkb1sjRHrOv5BvZXNYizV6ax01Cy9gSirHQlFufkdBirxgsG4BT4JCqASNEB46czuU6Zq3ls4rOW8ZkmeOqaFEzWIRzZlfsMnc5cWH3U64+7RJHrlNeFAZTdEySI6Y6RG5+9b+xe4h0NkR2/sUX1hhLMleWG/NHbtxLK9WXcZjmU78HuM2mUMya3+mI4huIExeDgiqwRRyu6cdszj5ZCNeC2xv8T9vsdeDoaZMhdfIUsZl4beUmix0RW4JK8UslkpKgld0Ee1ZTyf49aI8KfxN9+tXx1xUaeYpskaXzwY+NcQD+R/6djW9+mL1sKC1ppH596WBYgKwg5+KdcYuAwGCa41FU7FZZTMSoMshB0gaQjZJ8e4rvY87DaJrWOWPhmxOEa21qFX7kUiNChYfk7niCD4IK7JH6Gxtfzoj/AK2qMLv6psdZFjR0wt/P2SC+114gBGtEE/Y7Pqx68MeNsSR5GGS61usY4zG/AVRFIZQDoak5tGCTyX4wFABZzateIq6htNvTpOPMAMwD6dzMDuGk4qLctEMRLzPpJESe+2J9iMUba6ayWUBr5NKqTfTkyTU5WjJBYgsGC8uQUcgOS+TrZ1yGYZ7PWul+pW6QzmRuXJIoa1qpZtJXTvRPI22kCLGI22rqfCjSn4zr3aZ03i8IFxCdUdZF2sxcriw4qRGr8Y/dzcF0Ls/HQQEe862I+TzMVsPDDVGGybT2IUlN5WjYxzHnAI2gYqmhqWQsrjl8T68KC48SqmyzqtvaYF5SeR2iTg/B6EUVjiCrhDq6ZQgfXl+xX//Z"
              aspect-ratio="1"
              class="grey lighten-2">
              <template v-slot:placeholder>
                <v-row class="fill-height ma-0" align="center" justify="center">
                  <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                </v-row>
              </template>
            </v-img> -->
          </v-card>
        </v-col>

        <v-col cols="6" sm="3" xl="2">
          <v-card outlined class="d-flex">
            <img src="static/images/tipitaka.lk-logo-mono.png" width="100%">
            <!-- <v-img src="static/images/pitaka.lk-logo.jpg"
              lazy-src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAgACADASIAAhEBAxEB/8QAGQAAAwADAAAAAAAAAAAAAAAABAUGAgMJ/8QAJRAAAgICAgICAgMBAAAAAAAAAgMBBAUGERITIQciM0EUFjEj/8QAGAEBAAMBAAAAAAAAAAAAAAAAAgEDBQb/xAAnEQEAAgEDAgYCAwAAAAAAAAABAhEhAwQxAEEFEhMiIzIVsSRRYf/aAAwDAQACEQMRAD8A6V7huFrAWsfiMTiCyOQyRFAjBxAoCI/Iz99effvrHAn9omIggZ0q1l5anbc5ZyKnt4bVEpFMwBgSi6+hiJFc9ogZ4k46lEhJlI5bYKNao7brm65XAU87kiqV8xSiuBIUKmnBMRbSQEoFpEiaIsJYwZH4lrsMjL422vNbHgV7rlNryt9DsbSzNvHRp7q9RVR9QnKXj4CDY1/tUs62LcQQmAguWBAc5p+TxKRq7j3RlmMb9pHspdSZGcjV0d3rTmu1+PSwnL3v+jGAcY55erAdKZiVor6nmrmOGu4+iJZJJ6sIiOenseBg46xIxzI+57FBwTp+4XM9cv4fMYZmNyGOkeYkokLATH5F/uR59+uR4IPtM9hGX275e1vGaDtGc1DLY+9lMNgstk6tV4n1YVJIHMmH1KVz56pRMTEMU9RgUgYlK/DbHnnYLDbDsN0bR6y5WJyeZUEkORvpk0ZM11wTHiSLlsATnpJkJxC+sINi1HT8PfW22ImZRPqxwLV1FiZsq6pynUQZbr49XK8Pe/2i4zxyd+tpahhbrH67cxWXA8LdFVAsXk7tS2ms9wCzm5XbBimVyhkomREpr9y7kMytrR0j4zpw+lU0dh4u68Vfw3VGHjkG1LlGSKjP+SBYDmg00qEWfyC7yXJzD7cNOtZ+5jsxiMuWOyGNMiiYCJCwEx+Jk/71mY4/cdSP6zMiQhTul3EEx22YK1RWlvJ2QCSVEGYAoefsM9RYXaYKOZDkR5PxiIH4+Xo7hIwPrJCkLS0KihQj9quOV6cv5R6mmXJ5LzeO3cXJXF09RuK1H44G9dNnx/szwmH17FnKNyF0rqTX4m+aLBlLgNfoxbJdhq1IkSJNcFvspqOpIuxQwul1cdZ2fKE7LMrICk2742HJtcapEn8xLTjt2mPJBciXWJb/ANzsZZaX6lhbd7zPPq5ipFPRZEJx25gfvAcDMlPWS5IeweMi9Q1C5gbmQzGXzB5G/kSifY8BWD/fEvn315nj11jgQ+sTBEVcIS3o7fSkTjL7SIhEjyg1UlMYurt/1SY7dNWUfKnBeV/YDnPPB1//2Q=="
              aspect-ratio="1"
              class="grey lighten-2">
              <template v-slot:placeholder>
                <v-row class="fill-height ma-0" align="center" justify="center">
                  <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                </v-row>
              </template>
            </v-img> -->
          </v-card>
        </v-col>

      </v-row>
        
      <v-row>
        <v-col cols="12">
          <v-banner icon="mdi-information" color="info">
            අන්තර්ජාලය නැතිව භාවිතා ක හැකි මෘදුකාංග පහතින් බාගන්න. අටුවා සහ iOS මෘදුකාංග ළඟදීම බලාපොරොත්තු වන්න.
          </v-banner>
        </v-col>
      </v-row>
      <v-row class="download-software-list">
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
export default {
  metaInfo: {
    title: 'Welcome / පිළිගනිමු',
  },
}
</script>

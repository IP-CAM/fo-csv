/*
  Util import/export mixin
  used in util components both by export and import tools
*/
import { createNamespacedHelpers } from 'vuex'

export default function (module) {
  const { mapState, mapGetters, mapActions } = createNamespacedHelpers(module)

  return {
    computed: {
      ...mapState([
        'data'
      ]),
      ...mapGetters([
        'profile',
        'profiles'
      ])
    },
    methods: {
      restoreToProfile ({ name, profile }) {
        this.applyProfile({ name, profile })
        this.saveNewProfile(name)
      },
      deleteProfile (name) {
        if (confirm(this.$t('Are you sure you want remove this item?'))) {
          if (this.currentProfileName === name) {
            this.setCurrentProfileName('default')
          }

          this.storeDeleteProfile(name)
          this.saveAllProfiles(this.profiles)
        }
      },
      restoreProfiles (profiles) {
        if (confirm(this.$t('Are you sure? This will remove all profiles before trying to add new ones!'))) {
          this.saveAllProfiles(profiles)
        }
      },
      ...mapActions([
        'saveAllProfiles',
        'setCurrentProfileName',
        'applyProfile',
        'saveNewProfile'
      ]),
      ...mapActions({
        storeDeleteProfile: 'deleteProfile'
      })
    }
  }
}

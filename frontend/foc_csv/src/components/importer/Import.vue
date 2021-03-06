<template>
  <div class="foc-csv-import">
    <template v-if="working">
      <div class="panel panel-primary">
        <div class="panel-heading">
          {{ $t('Import in progress') }}
        </div>
        <div class="panel-body">
          <progress-bar :progress="{ current, total }"></progress-bar>
        </div>
      </div>
    </template>

    <error-message :errors="errors" :messages="errorMessages">
      <div>
        <p>{{ $t('We catched some errors during import, please check foc logs!') }}</p>
      </div>
    </error-message>

    <div class="panel panel-success" v-if="importComplete">
      <div class="panel-heading">
        {{ $t('Complete') }}
      </div>
      <div class="panel-body">
        <p>{{ $t('Import task successfully complete!') }}</p>
      </div>
    </div>

    <div class="row">
      <div class="col-md-12">
        <div class="row">
          <div class="col-md-8">
            <h1>{{ $t('Import submodule') }}</h1>
          </div>
          <div class="col-md-4 text-right">
            <button @click.prevent="submitImportData" :disabled="working" class="btn btn-warning btn-lg"><i class="fa fa-rocket"></i> {{ $t('Start import!') }}</button>
          </div>
        </div>
        <hr>
      </div>
      <div class="col-md-4">
        <left-sidebar></left-sidebar>
      </div>

      <div class="col-md-5">
        <div class="panel panel-primary">
          <div class="panel-heading">
            {{ $t('Fields settings') }}
          </div>
          <div class="panel-body">
            <csv-file-upload></csv-file-upload>

            <div class="row">
              <div class="col-md-6">
                <div class="form-group">
                  <label for="" class="label label-default">{{ $t('Process lines per query') }}</label>
                  <input type="text" v-model="processAtStepNum" class="form-control">
                </div>
                <div class="form-group">
                  <label for="" class="label label-default">{{ $t('Skip lines') }}</label>
                  <input type="text" class="form-control" v-model="skipLines">
                </div>
              </div>
              <div class="col-md-6">
                <div class="form-group">
                  <label class="label label-default">{{ $t('CSV headers control') }}</label>
                  <div class="checkbox">
                    <label>
                      <input type="checkbox" v-model="csvWithoutHeaders"> {{ $t('CSV without headers') }}
                    </label>
                  </div>
                </div>
                <div class="form-group">
                  <label for="" class="label label-default">{{ $t('CSV headers line number') }}</label>
                  <input :disabled="csvWithoutHeaders" type="text" class="form-control" v-model="csvHeadersLineNumber">
                </div>
              </div>
            </div>

            <div class="form-group">
              <label for="" class="label label-danger">{{ $t('Key field') }}</label>
              <select v-model="keyField" class="form-control">
                <option v-for="(field, idx) in keyFields" :key="idx">{{ field }}</option>
              </select>
            </div>

            <csv-to-db-matcher v-model="csvFieldsMatcher"></csv-to-db-matcher>
          </div>
        </div>
      </div>

      <div class="col-md-3">
        <right-sidebar></right-sidebar>
      </div>

      <div class="col-md-12">
        <additional-processing-settings></additional-processing-settings>
      </div>
    </div>
  </div>
</template>

<script>

import { createNamespacedHelpers } from 'vuex'
import { validateProfile } from '@/helpers'
import { mapVuexModels } from 'vuex-models'
import ProgressBar from '@/components/common/ProgressBar'
import CsvFileUpload from './CsvFileUpload'
import RightSidebar from './RightSidebar'
import LeftSidebar from './LeftSidebar'
import ErrorMessage from '@/components/common/ErrorMessage'
import CsvToDbMatcher from './CsvToDbMatcher'
import AdditionalProcessingSettings from './AdditionalProcessingSettings'

const { mapGetters, mapActions } = createNamespacedHelpers('importer')

export default {
  name: 'import',
  components: {
    CsvFileUpload,
    ProgressBar,
    RightSidebar,
    LeftSidebar,
    CsvToDbMatcher,
    ErrorMessage,
    AdditionalProcessingSettings
  },
  data () {
    return {
      msg: 'Import',
      newProfileName: '',
      importingCsvProgress: false,
      csvImportProgress: {
        current: 0,
        total: 0
      },
      errors: 0,
      errorMessages: '',
      importComplete: false
    }
  },
  computed: {
    ...mapGetters([
      'profile',
      'keyFields',
      'submittableData',
      'importMode',
      'currentProfile'
    ]),
    ...mapVuexModels([
      'processAtStepNum',
      'skipLines',
      'csvWithoutHeaders',
      'csvHeadersLineNumber',
      'keyField'
    ], 'importer'),
    ...mapVuexModels({
      total: 'importJobTotal',
      current: 'importJobCurrent',
      working: 'importJobWorking'
    }, 'importer'),
    csvFieldsMatcher: {
      get () {
        return this.currentProfile.bindings
      },
      set (value) {
        this.setBindings(value)
      }
    }
  },
  methods: {
    setErrorState () {
      this.current = 0
      this.working = false
      this.errors = this.errors || 1
    },
    async submitImportPart (callbackUrl, requestConfig) {
      try {
        let response = await this.$api.importer.submitPart({
          callbackUrl,
          options: {
            ...requestConfig,
            profile: this.profile
          }
        })

        if (response.data.status === 'fail') {
          this.errorMessages = response.data.message
          this.errors = 1
          this.setErrorState()
          return
        }

        let position = response.data.message.position

        this.current = position

        if (this.current < this.total) {
          this.submitImportPart(callbackUrl, response.data.message)
        }
        else {
          this.working = false
          this.current = 0
          this.errors = response.data.message.errors
          this.importComplete = true
        }
      }
      catch (e) {
        this.setErrorState()
      }
    },
    async submitImportData () {
      this.importComplete = false

      let data = this.submittableData
      // reset errors counter
      this.errors = 0

      if (!this.checkIfDestructive(data.profile)) {
        alert(this.$t('Import canceled!'))
        return false
      }

      if (validateProfile(data.profile)) {
        try {
          let response = await this.$api.importer.submitData(data)

          if (response.data.status === 'ok') {
            this.total = response.data.message.csvTotal
            this.working = true
            this.submitImportPart(response.data.message.importUrl, response.data.message)
          }
        }
        catch (e) {
          this.working = false
          this.current = 0
          alert(this.$t('Error during sending!'))
          console.error(e)
        }
      }
      else {
        alert(this.$t('Invalid profile!'))
      }
    },
    checkIfDestructive (profile) {
      if (profile.importMode === 'removeByList' || profile.importMode === 'removeOthers') {
        return confirm(this.$t('Are you totally sure you want do this???! With this import method you can lose your data!'))
      }

      return true
    },
    ...mapActions([
      'setBindings'
    ])
  },
  created () {

  }
}
</script>

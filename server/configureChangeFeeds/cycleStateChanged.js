/* eslint-disable no-console, camelcase */
import {CYCLE_STATES, PRACTICE} from 'src/common/models/cycle'
import {processStateChangefeed} from './util'

export default function cycleStateChanged(cycleStateChangedQueues) {
  processStateChangefeed({
    tableName: 'cycles',
    changefeedName: 'cycle state changed',
    states: CYCLE_STATES,
    statesWithExtendedTimeout: [PRACTICE],
    queues: cycleStateChangedQueues,
  })
}

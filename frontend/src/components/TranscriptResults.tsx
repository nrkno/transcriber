import update from "immutability-helper"
import React, { Component } from "react"
import ReactGA from "react-ga"
import KeyboardEventHandler from "react-keyboard-event-handler"
import TrackVisibility from "react-on-screen"
import { connect } from "react-redux"
import { ActionCreators as UndoActionCreators } from "redux-undo"
import { database } from "../firebaseApp"
import { IResult, ITranscript, IWord } from "../interfaces"
import secondsToTime from "../secondsToTime"
import { readResults, updateWords } from "../store/actions/resultsActions"
import Player from "./Player"
import Word from "./Word"

interface IProps {
  transcript: ITranscript
  transcriptId: string
}

interface IState {
  currentTime: number
  currentPlayingResultIndex?: number
  currentPlayingWordIndex?: number
  currentSelectedResultIndex?: number
  currentSelectedWordIndexStart?: number
  currentSelectedWordIndexEnd?: number
  results?: IResult[]
  resultIds?: string[]
  resultIndecesWithChanges?: boolean[]
  editString?: string
}

class TranscriptResults extends Component<IProps, IState> {
  private playerRef = React.createRef<Player>()

  constructor(props: any) {
    super(props)
    this.state = {
      currentTime: 0,
    }
  }
  /*
  public fetchResults() {
    const results = Array<IResult>()
    const resultIds = Array<string>()
    const resultIndecesWithChanges = Array<boolean>()

    database
      .collection(`transcripts/${this.props.transcriptId}/results`)
      .orderBy("startTime")
      .get()
      .then(querySnapshot => {
        querySnapshot.forEach(doc => {
          const result = doc.data() as IResult

          results.push(result)
          resultIds.push(doc.id)
          resultIndecesWithChanges.push(false)
        })

        this.setState({
          resultIds,
          resultIndecesWithChanges,
          results,
        })
      })
  }
*/
  public componentDidUpdate(prevProps: IProps, prevState: IState) {
    console.log("componentDidUpdate")

    // Check last editing words ends with a space, in that case, we remove it.
    // Edit string ends with space and we are finished editing. We remove the extra space

    if (
      this.state.editString === undefined &&
      prevState.editString &&
      prevState.editString.endsWith(" ") &&
      this.props.results.present.results &&
      prevState.currentSelectedResultIndex !== undefined &&
      prevState.currentSelectedWordIndexEnd !== undefined
    ) {
      const wordWithoutSpace = this.props.results.present.results[prevState.currentSelectedResultIndex].words[prevState.currentSelectedWordIndexEnd].word.trim()

      console.log(`wordWithoutSpace${wordWithoutSpace}X`)
      const results = update(this.props.results.present.results, {
        [prevState.currentSelectedResultIndex]: {
          words: {
            [prevState.currentSelectedWordIndexEnd]: {
              word: { $set: wordWithoutSpace },
            },
          },
        },
      })

      this.setState({ results })
    }
    /*
    if (this.props.transcriptId !== prevProps.transcriptId) {
      this.fetchResults()

      // Reset state

      this.setState({
        currentPlayingResultIndex: undefined,
        currentPlayingWordIndex: undefined,
        currentTime: 0,
        results: undefined,
      })
    }
    */
  }

  public componentDidMount() {
    this.props.readResults(this.props.transcriptId)

    // this.fetchResults()
  }
  public handleTimeUpdate = (currentTime: number) => {
    // Find the next current result and word

    const { currentPlayingResultIndex: currentResultIndex, currentPlayingWordIndex: currentWordIndex } = this.state

    if (this.props.transcript === undefined || this.props.results.present.results === undefined) {
      return
    }

    const results = this.props.results.present.results

    // First, we check if the current word is still being said

    if (currentResultIndex !== undefined && currentWordIndex !== undefined) {
      const currentWord = results[currentResultIndex].words[currentWordIndex]

      if (currentTime < currentWord.endTime * 1e-9) {
        return
      }
    }
    // The current word has been said, start scanning for the next word
    // We assume that it will be the next word in the current result

    let nextWordIndex = 0
    let nextResultIndex = 0

    if (currentResultIndex !== undefined && currentWordIndex !== undefined) {
      nextWordIndex = currentWordIndex ? currentWordIndex + 1 : 0
      nextResultIndex = currentResultIndex

      if (nextWordIndex === results[currentResultIndex].words.length) {
        // This was the last word, reset word index and move to next result

        nextWordIndex = 0
        nextResultIndex = nextResultIndex + 1
      }
    }

    // Start scanning for next word
    for (let i = nextResultIndex; i < results.length; i++) {
      const words = results[i].words

      for (let j = nextWordIndex; j < words.length; j++) {
        const word = words[j]

        const { startTime, endTime } = word

        if (currentTime < startTime * 1e-9) {
          // This word hasn't started yet, returning and waiting to be called again on new current time update
          return
        }

        if (currentTime > endTime * 1e-9) {
          // This word is no longer being said, go to next
          continue
        }

        this.setState({ currentTime, currentPlayingResultIndex: i, currentPlayingWordIndex: j })

        return
      }
    }
  }

  public setCurrentPlayingWord = (word: IWord, resultIndex: number, wordIndex: number) => {
    this.playerRef.current!.setTime(word.startTime * 1e-9)

    this.setState({
      currentPlayingResultIndex: resultIndex,
      currentPlayingWordIndex: wordIndex,
    })
  }

  public render() {
    return (
      <>
        <KeyboardEventHandler handleKeys={["all"]} onKeyEvent={(key, event) => this.handleKeyPressed(key, event)} />
        {this.props.results.present &&
          this.props.results.present.results &&
          this.props.results.present.results.map((result, i) => {
            console.log("HEI")

            const startTime = result.startTime

            const formattedStartTime = secondsToTime(startTime * 1e-9)

            return (
              <React.Fragment key={i}>
                <div key={`startTime-${i}`} className="startTime">
                  {i > 0 ? formattedStartTime : ""}
                </div>
                <div key={`result-${i}`} className="result">
                  <TrackVisibility partialVisibility={true}>
                    {({ isVisible }) => {
                      if (isVisible) {
                        return result.words.map((word, j) => {
                          const isPlaying = this.state.currentPlayingResultIndex === i && this.state.currentPlayingWordIndex === j
                          const isSelecting = this.state.currentSelectedResultIndex === i && this.state.currentSelectedWordIndexStart <= j && j <= this.state.currentSelectedWordIndexEnd
                          const isEditing = isSelecting && j === this.state.currentSelectedWordIndexEnd && this.state.editString
                          const shouldSelectSpace = this.state.currentSelectedResultIndex === i && this.state.currentSelectedWordIndexStart <= j && j < this.state.currentSelectedWordIndexEnd
                          return (
                            <Word
                              key={`word-${i}-${j}`}
                              confidence={Math.round(word.confidence * 100)}
                              word={word}
                              isPlaying={isPlaying}
                              isSelecting={isSelecting}
                              isEditing={isEditing}
                              shouldSelectSpace={shouldSelectSpace}
                              setCurrentWord={this.setCurrentPlayingWord}
                              resultIndex={i}
                              wordIndex={j}
                            />
                          )
                        })
                      } else {
                        return result.words.map(word => {
                          return word.word + " "
                        })
                      }
                    }}
                  </TrackVisibility>
                </div>
              </React.Fragment>
            )
          })}

        <Player ref={this.playerRef} playbackGsUrl={this.props.transcript.playbackGsUrl} handleTimeUpdate={this.handleTimeUpdate} />
      </>
    )
  }

  private handleKeyPressed(keyX: string, event: KeyboardEvent) {
    if (event.defaultPrevented) {
      return // Do nothing if the event was already processed
    }

    const key = event.key
    console.log("event.key:", event.key)

    // If left or right is pressed, we reset the indeces to 0,0 and return,
    // so that the first word is highlighted
    if ((key === "ArrowLeft" || key === "ArrowRight") && this.state.currentSelectedResultIndex === undefined && this.state.currentSelectedWordIndexStart === undefined) {
      this.setState({
        currentSelectedResultIndex: 0,
        currentSelectedWordIndexEnd: 0,
        currentSelectedWordIndexStart: 0,
      })
      return
    }

    const currentPlayingResultIndex = this.state.currentPlayingResultIndex!
    const currentPlayingWordIndex = this.state.currentPlayingWordIndex!
    const currentSelectedResultIndex = this.state.currentSelectedResultIndex!
    const currentSelectedWordIndexStart = this.state.currentSelectedWordIndexStart!
    const currentSelectedWordIndexEnd = this.state.currentSelectedWordIndexEnd!
    const results = this.props.results.present.results!

    if (currentSelectedResultIndex !== undefined && currentSelectedWordIndexStart !== undefined) {
      const currentWord = results![currentSelectedResultIndex].words[currentSelectedWordIndexEnd].word

      switch (event.key) {
        case "Enter":
          if (event.getModifierState("Meta")) {
            this.splitResult(currentSelectedResultIndex, currentSelectedWordIndexStart)
          } else {
            console.log("Enter")
            // Go in and out of edit mode
            if (this.state.editString) {
              this.setState({
                editString: undefined,
              })
            } else {
              this.setState({
                editString: currentWord,
              })
            }
          }

          break
        case "ArrowLeft":
        case "Left":
          if (event.getModifierState("Meta")) {
            // Move playing marker to selected marker

            const markedWord = results[currentSelectedResultIndex].words[currentSelectedWordIndexStart]
            this.setCurrentPlayingWord(markedWord, currentSelectedResultIndex, currentSelectedWordIndexStart)
          } else {
            // Move selected marker

            if (currentSelectedWordIndexStart - 1 >= 0) {
              // Select previous word
              const previousWordIndex = currentSelectedWordIndexStart - 1
              this.setState({
                currentSelectedWordIndexEnd: previousWordIndex,
                currentSelectedWordIndexStart: previousWordIndex,
                editString: undefined,
              })
            } else if (currentSelectedResultIndex - 1 >= 0) {
              // Select last word in previous result

              console.log(results[currentSelectedResultIndex - 1].words.length - 1)
              this.setState({
                currentSelectedResultIndex: currentSelectedResultIndex - 1,
                currentSelectedWordIndexEnd: results[currentSelectedResultIndex - 1].words.length - 1,
                currentSelectedWordIndexStart: results[currentSelectedResultIndex - 1].words.length - 1,
                editString: undefined,
              })
              console.log(this.state)
            }
          }

          break

        case "ArrowRight":
        case "Right":
          if (event.getModifierState("Meta")) {
            // Move selected marker to playing marker

            this.setState({
              currentSelectedResultIndex: currentPlayingResultIndex,
              currentSelectedWordIndexEnd: currentPlayingWordIndex,
              currentSelectedWordIndexStart: currentPlayingWordIndex,
              editString: undefined,
            })
          } else {
            const largestSelectedIndex = Math.max(currentSelectedWordIndexStart, currentSelectedWordIndexEnd)
            // If shift key is pressed, check if there is another word after currentSelectedWordIndexEnd
            if (event.getModifierState("Shift") && currentSelectedWordIndexEnd + 1 < results[currentSelectedResultIndex].words.length) {
              this.setState({
                currentSelectedWordIndexEnd: currentSelectedWordIndexEnd + 1,
                editString: undefined,
              })
            } else if (largestSelectedIndex + 1 < results[currentSelectedResultIndex].words.length) {
              // Select next word
              const nextWordIndex = largestSelectedIndex + 1
              this.setState({
                currentSelectedWordIndexEnd: nextWordIndex,
                currentSelectedWordIndexStart: nextWordIndex,
                editString: undefined,
              })
            } else if (currentSelectedResultIndex + 1 < results.length) {
              console.log("Hiii")
              // Select first word in next result
              this.setState({
                currentSelectedResultIndex: currentSelectedResultIndex + 1,
                currentSelectedWordIndexEnd: 0,
                currentSelectedWordIndexStart: 0,
                editString: undefined,
              })
            }
          }

          break

        case "ArrowUp":
        case "Up":
          // Jump to first word in current result
          if (currentSelectedWordIndexStart > 0) {
            this.setState({
              currentSelectedWordIndexEnd: 0,
              currentSelectedWordIndexStart: 0,
              editString: undefined,
            })
            // Jump to previous result
          } else if (currentSelectedResultIndex > 0) {
            this.setState({
              currentSelectedResultIndex: currentSelectedResultIndex - 1,
              currentSelectedWordIndexEnd: 0,
              currentSelectedWordIndexStart: 0,
              editString: undefined,
            })
          }

          break

        case "ArrowDown":
        case "Down":
          // Jump to next result if it exists
          if (currentSelectedResultIndex < results.length - 1) {
            this.setState({
              currentSelectedResultIndex: currentSelectedResultIndex + 1,
              currentSelectedWordIndexEnd: 0,
              currentSelectedWordIndexStart: 0,
              editString: undefined,
            })
          }
          // Jump to last word
          else {
            const indexOfLastWord = results[currentSelectedResultIndex].words.length - 1
            this.setState({
              currentSelectedWordIndexEnd: indexOfLastWord,
              currentSelectedWordIndexStart: indexOfLastWord,
              editString: undefined,
            })
          }

          break

        //
        // Tab will rotate the word from lowercase, first letter capitalized to all caps
        // Only works when not in edit mode, and only on a single word
        case "Tab":
          if (this.state.editString === undefined && currentSelectedWordIndexStart === currentSelectedWordIndexEnd) {
            // Lower case to capitalised case
            if (currentWord === currentWord.toLowerCase()) {
              this.updateWords(currentSelectedResultIndex, currentSelectedWordIndexStart, currentSelectedWordIndexEnd, [currentWord[0].toUpperCase() + currentWord.substring(1)], false)
            }
            // Lower case
            else {
              this.updateWords(currentSelectedResultIndex, currentSelectedWordIndexStart, currentSelectedWordIndexEnd, [currentWord.toLowerCase()], false)
            }
          }
          break

        case " ":
          if (this.state.editString === undefined) {
            this.playerRef.current!.togglePlay()
            break
          }

        // Punctation
        // When we're not in edit mode,
        case ".":
        case ",":
        case "!":
        case "?":
          if (this.state.editString === undefined) {
            const wordText = results![currentSelectedResultIndex].words[currentSelectedWordIndexEnd].word
            const nextWord = results[currentSelectedResultIndex].words[currentSelectedWordIndexEnd + 1]
            const wordTextLastChar = wordText.charAt(wordText.length - 1)

            let removePuncation = false
            let addPuncation = false
            let nextWordToLowerCase = false
            let nextWordToUpperCase = false

            //
            // Remove punctation
            //

            // If last char is a punctation char, we remove it

            if (wordTextLastChar === "." || wordTextLastChar === "," || wordTextLastChar === "!" || wordTextLastChar === "?") {
              removePuncation = true

              // Lower case next word if it exist and is not lower case

              if (nextWord !== undefined && (key === "." || key === "!" || key === "?") && nextWord.word[0] === nextWord.word[0].toUpperCase()) {
                nextWordToLowerCase = true
              }
            }

            //
            // Add punctation
            //

            if (wordTextLastChar !== key) {
              // Add punctation

              addPuncation = true

              // Check to see if we need to lower case the next word
              if (nextWord !== undefined) {
                if (key === "." || key === "!" || key === "?") {
                  if (nextWord.word[0] !== nextWord.word[0].toUpperCase()) {
                    nextWordToUpperCase = true
                  } else {
                    // Next word is already uppercase, cancel the effect of nextWordToLowerCase = true from above
                    nextWordToLowerCase = false
                  }
                } else if (nextWord.word[0] !== nextWord.word[0].toLowerCase()) {
                  nextWordToLowerCase = true
                }
              }
            }

            let firstWordText = wordText
            let nextWordText = null

            if (removePuncation) {
              firstWordText = firstWordText.slice(0, -1)
            }
            if (addPuncation) {
              firstWordText += key
            }

            if (nextWordToUpperCase) {
              nextWordText = nextWord.word[0].toUpperCase() + nextWord.word.substring(1)
            } else if (nextWordToLowerCase) {
              nextWordText = nextWord.word[0].toLowerCase() + nextWord.word.substring(1)
            }

            const words = [firstWordText, nextWordText].filter(word => word)

            this.props.updateWords(currentSelectedResultIndex, currentSelectedWordIndexStart, currentSelectedWordIndexEnd + words.length - 1, words, false)

            break
          }
        // Saving
        case "S":
          if (event.getModifierState("Meta")) {
            this.save()

            break
          }
        case "z":
          if (event.getModifierState("Meta")) {
            if (event.getModifierState("Shift")) {
              this.props.onRedo()
            } else {
              this.props.onUndo()
            }
            break
          }
        case "a":
        case "b":
        case "c":
        case "d":
        case "e":
        case "f":
        case "g":
        case "h":
        case "i":
        case "j":
        case "k":
        case "l":
        case "m":
        case "n":
        case "o":
        case "p":
        case "q":
        case "r":
        case "s":
        case "t":
        case "u":
        case "v":
        case "w":
        case "x":
        case "y":

        case "æ":
        case "ø":
        case "å":
        case "A":
        case "B":
        case "C":
        case "D":
        case "E":
        case "F":
        case "G":
        case "H":
        case "I":
        case "J":
        case "K":
        case "L":
        case "M":
        case "N":
        case "O":
        case "P":
        case "Q":
        case "R":
        case "T":
        case "U":
        case "V":
        case "W":
        case "X":
        case "Y":
        case "Z":
        case "Æ":
        case "Ø":
        case "Å":
        case "'":
        case "-":
        case '"':

        case "Backspace":
          // Change the selected word

          let editString = this.state.editString

          if (key === "Backspace") {
            if (editString === undefined) {
              editString = currentWord
            }
            editString = editString.slice(0, -1)
          } else if (this.state.editString) {
            editString += key
          } else {
            editString = key
          }
          console.log("EDIT STRING: ", editString)
          this.setWords(currentSelectedResultIndex, currentSelectedWordIndexStart, currentSelectedWordIndexEnd, editString)
          break
        case "Delete":
          this.deleteWords(currentSelectedResultIndex, currentSelectedWordIndexStart, currentSelectedWordIndexEnd, false)
          break
      }

      // Cancel the default action to avoid it being handled twice
      event.preventDefault()
      event.stopPropagation()
    }
  }

  private async save() {
    /*TODO
    const resultIndecesWithChanges = this.state.resultIndecesWithChanges!

    try {
      for (const [index, hasChanges] of resultIndecesWithChanges.entries()) {
        const results = this.props.results.present.results!

        console.log(index)
        console.log(hasChanges)

        if (hasChanges) {
          const result = results[index]
          const resultId = this.state.resultIds![index]

          await database.doc(`transcripts/${this.props.transcriptId}/results/${resultId}`).set({ words: result.words }, { merge: true })

          // await database.doc(`transcripts/${this.props.transcriptId}/results/${resultId}`).update({ words: result.words })
        }
      }

      // Reset change flags
      this.setState({ resultIndecesWithChanges: new Array(resultIndecesWithChanges.length).fill(false) })
    } catch (error) {
      console.error(error)
      ReactGA.exception({
        description: error.message,
        fatal: false,
      })
    }
    */
  }

  private deleteWords(resultIndex: number, wordIndexStart: number, wordIndexEnd: number, selectPreviousWord: boolean) {
    const results = update(this.props.results.present.results, {
      [resultIndex]: {
        words: { $splice: [[wordIndexStart, wordIndexEnd - wordIndexStart + 1]] },
      },
    })
    /*
    const resultIndecesWithChanges = update(this.state.resultIndecesWithChanges, {
      [resultIndex]: { $set: true },
    })
*/
    let currentSelectedWordIndexStart = this.state.currentSelectedWordIndexStart!

    // Select the previous word
    if (selectPreviousWord && wordIndexStart > 0) {
      currentSelectedWordIndexStart--
    }

    this.setState({
      currentSelectedWordIndexEnd: currentSelectedWordIndexStart,
      currentSelectedWordIndexStart,
      editString: undefined,
      // resultIndecesWithChanges,
      results,
    })
  }

  private setWords(resultIndex: number, wordIndexStart: number, wordIndexEnd: number, text: string) {
    // Replaces a consecutive set of whitespace characters by a single white space.
    // White spaces in the beginning and end are removed too
    // "    This    should  become   something          else   too. ";
    // becomes
    // "This should become something else too."
    let cleanText = text.replace(/\s+/g, " ").trim()

    const textLengthWithoutSpaces = cleanText.split(" ").join("").length

    const results = this.props.results.present.results!
    const wordStart = results[resultIndex].words[wordIndexStart]
    const wordEnd = results[resultIndex].words[wordIndexEnd]

    if (textLengthWithoutSpaces === 0) {
      // Delete words
      console.log("HSOULD DELETE")
      this.deleteWords(resultIndex, wordIndexStart, wordIndexEnd, true)
      return
    }

    console.log("textLengthWithoutSpaces", textLengthWithoutSpaces)

    const nanosecondsPerCharacter = (wordEnd.endTime - wordStart.startTime) / textLengthWithoutSpaces
    console.log("nanosecondsPerCharacter", nanosecondsPerCharacter)
    const newWords = Array<IWord>()

    let startTime = wordStart.startTime
    for (const t of cleanText.split(" ")) {
      const duration = t.length * nanosecondsPerCharacter
      const endTime = startTime + duration
      console.log("endTime", endTime)
      console.log("t", t)
      newWords.push({
        confidence: 1,
        endTime,
        startTime,
        word: t,
      })

      startTime = endTime
    }

    console.log("newWords", newWords)

    // If original entered string ends with a space, we add it to the last word again

    if (text.endsWith(" ")) {
      cleanText += " "
      newWords[newWords.length - 1].word += " "
    }

    // Replace array of words in result

    const newResults = update(this.props.results.present.results, {
      [resultIndex]: {
        words: { $splice: [[wordIndexStart, wordIndexEnd - wordIndexStart + 1, ...newWords]] },
      },
    })

    /*TODO
    const resultIndecesWithChanges = update(this.state.resultIndecesWithChanges, {
      [resultIndex]: { $set: true },
    })
*/
    this.setState({
      currentSelectedWordIndexEnd: wordIndexStart + newWords.length - 1,
      editString: cleanText,
      // TODO resultIndecesWithChanges,
      results: newResults,
    })
  }
  private updateWords(resultIndex: number, wordIndexStart: number, wordIndexEnd: number, words: string[], recalculate: boolean) {
    console.log("PRØVER Å SKRIVE over ord", resultIndex, wordIndexStart, wordIndexEnd, words, recalculate)

    this.props.updateWords(resultIndex, wordIndexStart, wordIndexEnd, words, recalculate)

    /*TODO const resultIndecesWithChanges = update(this.state.resultIndecesWithChanges, {
          [resultIndex]: { $set: true },
        })*/
  }

  private splitResult(resultIndex: number, wordIndex: number) {
    const results = this.props.results.present.results!

    // Return if we're at the last word in the result
    if (wordIndex === results[resultIndex].words.length - 1) {
      return
    }

    // The split will be done from the next word
    const start = wordIndex + 1

    // Making a deep copy of the results, splicing off the rest of the words in the current result
    const newResults = update(results, {
      [resultIndex]: {
        words: { $splice: [[start]] },
      },
    })

    // Deep clone the the rest of the words, which will be moved to the next result
    const wordsToMove: IWord[] = JSON.parse(JSON.stringify(results[resultIndex].words.slice(start)))
    console.log("wordToMove", wordsToMove)

    // Flag changes in both resultIndex and resultIndex + 1
    const resultIndecesWithChanges = update(this.state.resultIndecesWithChanges, {
      [resultIndex]: { $set: true },
      [resultIndex + 1]: { $set: true },
    })

    // Check if there's another result after the current one
    if (resultIndex + 1 < results.length) {
      newResults[resultIndex + 1].words.splice(0, 0, ...wordsToMove)

      // Also need to update the start time of the result where we just added words
      newResults[resultIndex + 1].startTime = wordsToMove[0].startTime

      this.setState({
        resultIndecesWithChanges,
        results: newResults,
      })
    } else {
      // We're at the last result, create a new one
      // We push a new result to the array

      const result: IResult = {
        startTime: wordsToMove[0].startTime,
        words: wordsToMove,
      }

      newResults.push(result)

      // We also need to create a new id in result ids.

      const resultId = database.collection("/dummypath").doc().id

      const resultIds = update(this.state.resultIds, { $push: [resultId] })

      this.setState({
        resultIds,
        resultIndecesWithChanges,
        results: newResults,
      })
    }
  }
}

const mapStateToProps = (state: State): IStateProps => {
  return {
    results: state.results,
  }
}

const mapDispatchToProps = (dispatch: Dispatch): IDispatchProps => {
  return {
    onRedo: () => dispatch(UndoActionCreators.redo()),
    onUndo: () => dispatch(UndoActionCreators.undo()),
    readResults: (transcriptId: string) => dispatch(readResults(transcriptId)),
    updateWords: (resultIndex: number, wordIndexStart: number, wordIndexEnd: number, words: string[], recalculate: boolean) => dispatch(updateWords(resultIndex, wordIndexStart, wordIndexEnd, words, recalculate)),
  }
}

export default connect<void, IDispatchProps, void>(
  mapStateToProps,
  mapDispatchToProps,
)(TranscriptResults)

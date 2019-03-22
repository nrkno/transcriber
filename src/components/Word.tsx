import * as React from "react"
import * as ReactDOM from "react-dom"
import { IWord } from "../interfaces"

interface IProps {
  confidence: number
  showTypewriter: boolean
  isMarked: boolean
  isNextWordDeleted: boolean
  resultIndex: number
  shouldSelectSpace: boolean
  text: string
  word?: IWord
  wordIndex: number
  setCurrentWord(word: IWord, resultIndex: number, wordIndex: number): void
  setOffsetTop(offsetTop: number, resultIndex: number, wordIndex: number)
}

class Word extends React.Component<IProps, {}> {
  public componentDidMount() {
    const n = ReactDOM.findDOMNode(this)
    console.log("OFFSET TOP", n.offsetTop)
    //this.props.setOffsetTop(this.p)
  }

  public render() {
    return (
      <>
        <span style={{ backgroundColor: "green" }} onClick={this.handleWordClick} className={`word confidence-${this.props.confidence} ${this.props.isMarked ? "marker" : ""}`}>
          {this.props.word && this.props.word.deleted && this.props.word.deleted === true ? <s>{this.props.text}</s> : this.props.text}

          {(() => {
            // Type writer
            if (this.props.showTypewriter) {
              return <span className="typewriter" />
            } else {
              return
            }
          })()}
        </span>
        {(() => {
          // Space
          const strikeThrough = this.props.word && this.props.word.deleted && this.props.word.deleted === true && this.props.isNextWordDeleted === true
          if (this.props.shouldSelectSpace) {
            if (strikeThrough) {
              return <s className={this.props.isMarked ? "marker" : ""}> </s>
            } else {
              return (
                <span style={{ backgroundColor: "red" }} className={this.props.isMarked ? "marker" : ""}>
                  {" "}
                </span>
              )
            }
          } else if (strikeThrough) {
            return <s ref={node => node && console.log(node.offsetWidth)}> </s>
          } else {
            return " "
          }
        })()}
      </>
    )
  }

  private handleWordClick = (event: React.MouseEvent<HTMLTableRowElement, MouseEvent>) => {
    if (this.props.word) {
      this.props.setCurrentWord(this.props.word, this.props.resultIndex, this.props.wordIndex)
    }
  }
}

export default Word

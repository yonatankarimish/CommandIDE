onmessage = function(event) {
    const corpus = event.data;
    const rankedNgrams = getNgrams(corpus);
    postMessage(rankedNgrams);
}

//Construct an occurrence map by checking for nGram occurrence in the provided corpus, on a line-by-line basis
//Because this is a costly operation, invoked from the front-end framework wrapper on app load, using this web-worker.
function getNgrams(corpus, significanceThreshold=2){
    // Ensures terms surrounded by brackets (all kinds), quotes (all kinds) or %% marks (dynamic fields) are parsed as a single unigram
    // These are surrounded by a capture group to allow splitting the lines using the captured unigrams.
    const multigramRegex = /(%%[^%]*%%|\(.*\)|{.*}|\[.*\]|<.*>|"(?:[^"]|(?<=\\)")*"|'(?:[^']|(?<=\\)')*'|`(?:[^`]|(?<=\\)`)*`|https?:\/\/\S+)/g;

    const occurrences = {};
    for(const textLine of corpus){
        //Standardize the appearance of specific characters in the text (pipes, semicolons and commas)
        const standardizedLine = textLine
            .replace(/[\r\n ]+/g, " ")
            .replace(/\s*\|\s*/g, " | ")
            .replace(/\s*;\s*/g, "; ")
            .replace(/\s*,\s*/g, ", ");


        //Create nGrams for the occurence map
        const unigrams = standardizedLine.split(multigramRegex);
        for(let nGramSize=1; nGramSize<=unigrams.length; nGramSize++){
            for(let windowStart=0; windowStart<unigrams.length - nGramSize + 1; windowStart++){
                //Get the next nGram, using the current nGram size and the sliding window start index
                const nGram = unigrams.slice(windowStart, windowStart+nGramSize)
                    .join(" ")//join the unigrams with spaces
                    .replace(/(^[\r\n ]*[|;,]+|[|;,]+[\r\n ]*$)/g, "") //remove pipes, semicolons and comma characters from the start + end of the nGram
                    .replace(/\s*\t+\s*/g, "\t") //ensure tabs have no leading or trailing spaces
                    .replace(/[\r\n ]+/g, " ") //convert whitespace sequences to single spaces
                    .replace(/(^[\r\n ]+|[\r\n ]+$)/g, "") //and trim leading + trailing spaces

                //Only count textual nGrams, longer than the significance threshold
                if(nGram?.length >= significanceThreshold && isNaN(nGram)) {
                    if (!occurrences.hasOwnProperty(nGram)) {
                        occurrences[nGram] = 0;
                    }
                    occurrences[nGram]++;
                }
            }
        }
    }

    //Sort the occurrences by frequency (within the entire corpus), and return the keys as an nGram array
    return Object.entries(occurrences)
        .sort((term1, term2) => term2[1] - term1[1]) //sort by frequency (within the entire corpus)
        .map(match => match[0]); //and discard the frequencies
}
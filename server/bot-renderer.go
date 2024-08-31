package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/samber/lo"
)

// Compile the regex pattern (do this once, outside the handler)
var (
	excludePattern = regexp.MustCompile(`/(fts|dict)/`)
	botPathPattern = regexp.MustCompile(`Googlebot|facebookexternalhit`)
	treeData       map[string]TreeItem
	htmlTemplate   *template.Template
)

type ReplaceRules []struct {
	CompiledRegex  *regexp.Regexp
	ReplacementStr string
}

func (rules *ReplaceRules) applyReplacements(input string) string {
	result := input
	for _, rule := range *rules {
		result = rule.CompiledRegex.ReplaceAllString(result, rule.ReplacementStr)
	}
	return result
}

var textConvertRules = ReplaceRules{
	{regexp.MustCompile(`\{(.+?)\}`), ""},                                  // remove footnote pointers
	{regexp.MustCompile(`\x{0DCA}([\x{0DBA}\x{0DBB}])`), "\u0DCA\u200D$1"}, // yansa/rakar beautification
	{regexp.MustCompile(`\*\*(.*?)\*\*`), "<b>$1</b>"},                     // add bold
	{regexp.MustCompile(`__(.*?)__`), "<u>$1</u>"},                         // underline
	{regexp.MustCompile(`↴|\n`), "<br>"},                                   // if used {white-space: pre-wrap;} css this is not needed
	{regexp.MustCompile(`\$\$(.*?)\$\$`), "$1"},                            // just get rid of $$
}

func (e Entry) RenderText() template.HTML {
	return template.HTML(textConvertRules.applyReplacements(e.Text))
}

// func main() {
// 	initRenderer()
// 	path := "/sn-1-1-1-1/10-1/sinh"
// 	var pathInfo PathInfo
// 	if err := parsePath(path, &pathInfo); err != nil {
// 		fmt.Println("Error parsing path:", err)
// 	}
// 	fmt.Println(pathInfo)
// 	if _, ok := treeData[pathInfo.Key]; !ok {
// 		log.Fatalf("Given key: %s not found in tree", pathInfo.Key)
// 	}

// 	var doc Document
// 	loadTextFile("../dist/static/text/"+treeData[pathInfo.Key].File+".json", &doc)
// 	// Access and use the data
// 	fmt.Println(doc.Filename)

// 	entries := getEntriesForPath(&doc, pathInfo)
// 	for _, entry := range entries {
// 		fmt.Println(entry.Text)
// 	}

// 	// Create or open the output file
// 	file, err := os.Create("./rendered.html") // Adjust the file path as needed
// 	if err != nil {
// 		log.Fatal("Error creating file:", err)
// 	}
// 	defer file.Close()

// 	// Render the template and write to the file
// 	data := TemplateData{treeData[pathInfo.Key], pathInfo, entries, doc.Collection}
// 	err = htmlTemplate.Execute(file, data)
// 	if err != nil {
// 		log.Fatal("Error template execute:", err)
// 	}

// 	fmt.Println(len(treeData))
// }

type TemplateData struct {
	TreeItem   TreeItem
	PathInfo   PathInfo
	Entries    []Entry
	Collection string
	//Funcs    map[string]interface{}
}

func getTemplateData(path string) (*TemplateData, error) {
	//path := "/sn-1-1-1-1/10-1/sinh"
	var pathInfo PathInfo
	if err := parsePath(path, &pathInfo); err != nil {
		return nil, err
	}

	if _, ok := treeData[pathInfo.Key]; !ok {
		return nil, fmt.Errorf("given key: %s not found in tree", pathInfo.Key)
	}

	var textFilename = treeData[pathInfo.Key].File
	doc, err := loadTextFile(getPathToFile("dist/static/text/" + textFilename + ".json"))
	if err != nil {
		return nil, fmt.Errorf("error loading text file %s: %v", textFilename, err)
	}

	entries := getEntriesForPath(doc, pathInfo)
	data := TemplateData{treeData[pathInfo.Key], pathInfo, entries, doc.Collection}
	return &data, nil
}

// BotDetectionMiddleware detects Googlebot and Facebook crawlers and serves specific files
func BotRendererMiddleware(c *fiber.Ctx) error {
	// Check if the route matches the exclude pattern
	if excludePattern.MatchString(c.Path()) {
		return c.Next() // Skip bot detection for these routes
	}

	userAgent := c.Get("User-Agent")
	//if botPathPattern.MatchString(userAgent) {
	data, err := getTemplateData(c.Path())
	if err != nil {
		fmt.Printf("Error handling bot path %s: %v\n", c.Path(), err)
		return c.Next()
	}
	c.Response().Header.Set("Content-Type", "text/html")
	if err := htmlTemplate.Execute(c.Response().BodyWriter(), data); err != nil {
		fmt.Printf("Error handling bot path %s: %v\n", c.Path(), err)
		return c.Next()
	}
	fmt.Printf("Bot render for %s, path %s.\n", userAgent, c.Path())
	return nil // Indicate successful handling
	//}

	return c.Next()
}

func initBotRendererMiddleware() {
	// Load the HTML template
	var err error
	htmlTemplate, err = template.ParseFiles(getPathToFile("db/template.html"))
	if err != nil {
		log.Fatal("Error parsing template:", err)
	}
	// Read the JSON file
	data, err := os.ReadFile(getPathToFile("dist/static/data/tree.json"))
	if err != nil {
		log.Fatal("Error reading file:", err)
	}

	// Unmarshal into a map of TreeItem slices
	err = json.Unmarshal(data, &treeData)
	if err != nil {
		log.Fatal("Error unmarshalling JSON:", err)
	}
}

type Document struct {
	Filename   string     `json:"filename"`
	Pages      []PagePair `json:"pages"`
	BookId     int        `json:"bookId"`
	PageOffset int        `json:"pageOffset"`
	Collection string     `json:"collection"`
}

type PagePair struct {
	PageNum int  `json:"pageNum"`
	Pali    Page `json:"pali"`
	Sinh    Page `json:"sinh"`
}

func (dp *PagePair) getEntries(lang string, entryIndex int) []Entry {
	entryIndex = min(len(dp.Pali.Entries), entryIndex)
	if lang == "pali" {
		return dp.Pali.Entries[entryIndex:]
	}
	return dp.Sinh.Entries[entryIndex:]
}

type Page struct {
	Entries   []Entry `json:"entries"`
	Footnotes []Entry `json:"footnotes"`
}

type Entry struct {
	Type    string `json:"type"`
	Text    string `json:"text"`
	Level   int    `json:"level"`
	NoAudio bool   `json:"noAudio,omitempty"` // 'omitempty' handles optional fields
}

func loadTextFile(filename string) (*Document, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	var doc Document
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	return &doc, nil
}

func getEntriesForPath(doc *Document, pathInfo PathInfo) []Entry {
	location := treeData[pathInfo.Key].Location
	if pathInfo.Location.Page >= 0 {
		location = pathInfo.Location
	}
	if location.Page < 0 || location.Page >= len(doc.Pages) {
		fmt.Printf("Invalid page index: %d in route: %s\n", location.Page, pathInfo.String)
		location = treeData[pathInfo.Key].Location // reset back to using the sutta key
	}

	flattenedEntries := doc.Pages[location.Page].getEntries(pathInfo.Lang, location.Entry)

	startPage := min(location.Page+1, len(doc.Pages))
	endPage := min(location.Page+3, len(doc.Pages))
	for _, page := range doc.Pages[startPage:endPage] {
		flattenedEntries = append(flattenedEntries, page.getEntries(pathInfo.Lang, 0)...)
	}

	return flattenedEntries
}

type Location struct {
	Page  int `json:"0"`
	Entry int `json:"1"`
}
type PathInfo struct {
	Key      string
	Lang     string
	Location Location
	String   string
}

func parsePath(path string, info *PathInfo) error {
	info.String = strings.Trim(path, "/")
	parts := strings.Split(info.String, "/")

	if len(parts) < 1 || len(parts) > 3 {
		return fmt.Errorf("invalid path format: %s", path)
	}

	info.Key = parts[0]
	info.Lang = "pali" // default lang if path is like /dn-1
	if len(parts) >= 2 {
		info.Lang = parts[len(parts)-1]
	}
	info.Location.Page, info.Location.Entry = -1, -1

	if len(parts) == 3 {
		coordParts := strings.Split(parts[1], "-")
		if len(coordParts) != 2 {
			return fmt.Errorf("invalid location format: %s", parts[2])
		}

		var err error
		info.Location.Page, err = strconv.Atoi(coordParts[0])
		if err != nil {
			return fmt.Errorf("invalid page number: %s", coordParts[0])
		}
		info.Location.Entry, err = strconv.Atoi(coordParts[1])
		if err != nil {
			return fmt.Errorf("invalid entry number: %s", coordParts[1])
		}
	}

	return nil
}

type TreeItem struct {
	Pali     string   `json:"0"`
	Sinhala  string   `json:"1"`
	Level    int      `json:"2"`
	Location Location `json:"3"`
	Parent   string   `json:"4"`
	File     string   `json:"5"`
}
type HeadingLink struct {
	Name string // pali or sinhala heading name
	URL  string // url link to the heading
}

func (ti TreeItem) GetName(lang string) string {
	if lang == "sinh" {
		return ti.Sinhala
	}
	return ti.Pali
}
func (p PathInfo) GetTitle() string {
	return strings.Join(lo.Map(p.GetHeadingLinks(), func(hl HeadingLink, _ int) string {
		return hl.Name
	}), " < ")
}
func (p PathInfo) GetHeadingLinks() []HeadingLink {
	ti := treeData[p.Key]
	headings := []HeadingLink{{
		Name: ti.GetName(p.Lang),
		URL:  fmt.Sprintf("https://tipitaka.lk/%s/%s", p.Key, p.Lang),
	}}
	for ti.Parent != "root" {
		url := fmt.Sprintf("https://tipitaka.lk/%s/%s", ti.Parent, p.Lang)
		ti = treeData[ti.Parent]
		headings = append(headings, HeadingLink{
			Name: ti.GetName(p.Lang),
			URL:  url,
		})
	}
	return headings
}
func (p PathInfo) GetDescription(col string) string {
	colStr, langStr, pageStr := "බුද්ධ ජයන්ති ත්\u200dරිපිටකය", "පාළි", ""
	if strings.HasPrefix(p.Key, "atta") {
		colStr = "අටුවාව"
	} else if strings.HasPrefix(p.Key, "anya") {
		colStr = "අන්‍ය ග්‍රන්ථ"
	}
	if p.Lang == "sinh" {
		langStr = "සිංහල"
	}
	if p.Location.Page >= 0 {
		pageStr = fmt.Sprintf("- %d පිටුව", p.Location.Page+1)
	}
	return fmt.Sprintf("%s - %s%s", colStr, langStr, pageStr)
}

// Custom UnmarshalJSON method needed because the json array contains values of different types
func (ti *TreeItem) UnmarshalJSON(data []byte) error {
	var v []interface{}
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}

	if len(v) != 6 {
		return fmt.Errorf("invalid TreeItem format: expected 6 elements, got %d", len(v))
	}

	// Type assertions and assignments
	ti.Pali = v[0].(string)
	ti.Sinhala = v[1].(string)
	ti.Level = int(v[2].(float64))

	coords, ok := v[3].([]interface{})
	if !ok || len(coords) != 2 {
		return fmt.Errorf("invalid Entry Index format")
	}
	ti.Location.Page = int(coords[0].(float64))
	ti.Location.Entry = int(coords[1].(float64))

	ti.Parent = v[4].(string)
	ti.File = v[5].(string)

	return nil
}

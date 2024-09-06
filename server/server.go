package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/fatih/color"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/skratchdot/open-golang/open"
	//_ "modernc.org/sqlite"
)

type QueryPayload struct {
	DBName string `json:"dbname"`
	Query  string `json:"query"`
}

var (
	dbConnections = make(map[string]*sqlx.DB)
	mutex         sync.Mutex
	APPNAME       = "Tipitaka.lk v2.0"
	userBJTPath   = "" // call such as ./server -bjt-path=/Volumes/1TB/Webstorm/pitaka/bjt/newbooks
	rootPath      = "" // call such as ./server -root-path=../../ relative to the exePath
	exePath       = "" // determined programmetically below
	PORT          = ":8400"
	URL           = "http://localhost" + PORT
)

func getPathToFile(file string) string {
	return filepath.Join(exePath, rootPath, file)
}

func main() {
	printBox()

	noOpen := flag.Bool("no-open", false, "Prevent opening the URL in the browser")
	flag.StringVar(&userBJTPath, "bjt-path", "", "Local folder where BJT scanned pages are located.")
	flag.StringVar(&rootPath, "root-path", "", "Where dist and dbs are located relative to the binary location.")
	flag.Parse() // Parse the command-line flags
	exeFile, _ := os.Executable()
	exePath = filepath.Dir(exeFile)
	color.White("Flags no-open=%t, bjt-path=%s, root-path=%s, exePath: %s", *noOpen, userBJTPath, rootPath, exePath)

	app := fiber.New(fiber.Config{AppName: APPNAME, DisableStartupMessage: true})

	// Use gzip compression middleware
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed, // Adjust compression level as needed
	}))

	initBotRendererMiddleware()
	// serve pre-rendered pages to google/fb bots
	app.Use(BotRendererMiddleware)

	// Define the endpoint for sqlite queries
	app.Post("/sql-query", func(c *fiber.Ctx) error {
		//return executeQueryAndReturnJSON(c)
		var payload QueryPayload
		if err := c.BodyParser(&payload); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}

		// Get or create database connection
		mutex.Lock()
		db, exists := dbConnections[payload.DBName]
		if !exists {
			var err error
			db, err = sqlx.Open("sqlite3", getPathToFile("db/"+payload.DBName))
			if err != nil {
				mutex.Unlock()
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
			}
			dbConnections[payload.DBName] = db
		}
		mutex.Unlock()

		// Execute the SQL query
		rows, err := db.Queryx(payload.Query)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		defer rows.Close()

		// Scan results into a slice of maps
		var results []map[string]interface{}
		for rows.Next() {
			result := make(map[string]interface{})
			err = rows.MapScan(result)
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
			}
			results = append(results, result)
		}

		// Return the results as JSON
		return c.JSON(results)
	})

	scanPagesPath, found := getBJTParams(userBJTPath)
	BJTResponse := ""
	if found {
		BJTResponse = "/bjt-scanned-pages|jpg"
		color.Green("Scanned BJT pages found at %s. Will be served from there.", scanPagesPath)
		app.Static("/bjt-scanned-pages", scanPagesPath)
	}
	app.Get("/tipitaka-query/bjt-params", func(c *fiber.Ctx) error {
		return c.SendString(BJTResponse)
	})
	app.Get("/tipitaka-query/version", func(c *fiber.Ctx) error {
		return c.SendString(APPNAME)
	})

	// Serve static files from dist folder
	app.Static("/", getPathToFile("dist"))
	// Define the "not found" handler to serve index.html - handles routes such as http://localhost:8400/dict/janaka
	app.Static("*", getPathToFile("dist/index.html")) // not found handler

	if !*noOpen {
		//color.Green("If your browser does not open automatically visit the following URL in your browser.")
		//color.Yellow("URL: %s", URL)
		if err := open.Start(URL); err != nil {
			color.Red("Failed to open URL(%s) %s", URL, err)
		}
	} else {
		color.White("URL (%s) not opened due to -no-open flag.", URL)
	}

	// Run the server
	log.Fatal(app.Listen(PORT))
}

// Function to execute query and return results as JSON
/*func executeQueryAndReturnJSON(c *fiber.Ctx) error {
	var payload QueryPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	// Get or create database connection (same as before)
	mutex.Lock()
	db, exists := dbConnections[payload.DBName]
	if !exists {
		var err error
		db, err = sql.Open("sqlite", filepath.Join(exePath, rootPath, "db", payload.DBName))
		if err != nil {
			mutex.Unlock()
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		dbConnections[payload.DBName] = db
	}
	mutex.Unlock()

	// Execute the SQL query
	rows, err := db.Query(payload.Query)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Prepare the results slice
	var results []map[string]interface{}

	// Iterate over rows and scan values
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}

		// Create a map for each row
		entry := make(map[string]interface{})
		for i, col := range columns {
			var v interface{}
			val := values[i]

			// Convert byte slices to strings if needed
			b, ok := val.([]byte)
			if ok {
				v = string(b)
			} else {
				v = val
			}
			entry[col] = v
		}
		results = append(results, entry)
	}

	// Return the results as JSON
	return c.JSON(results)
}*/

func getBJTParams(userBJTPath string) (string, bool) { // only supports bjt_newbooks/jpg
	path := "/Pictures/bjt_newbooks/"
	if userBJTPath != "" {
		path = userBJTPath
	}
	filename := "10/DN1_Page_001.jpg"
	locations := []string{"", "C:", "D:", "E:"} // empty for linux/mac
	for _, loc := range locations {
		fullPath := filepath.Join(loc, path, filename)
		if _, err := os.Stat(fullPath); err == nil {
			return loc + path, true // File found
		}
	}
	return "", false // File not found in any of the paths
}

func printBox() {
	gray := color.New(color.FgHiBlack)
	lines := []struct {
		Text  string
		Color *color.Color // Store the Color object directly
	}{
		{APPNAME, color.New(color.FgCyan, color.Bold)},
		{"┈┈┈┈┈┈┈┈┈┈┈┈", gray},
		{URL, color.New(color.FgYellow)},
		{"Visit the above URL in your browser to see the App.", color.New(color.FgHiGreen)},
		{"┄┄┄┄┄┄┄┄┄┈┈┈", gray},
		{"Suggestions and Errors - path.nirvana@gmail.com", gray},
		{"┄┄┄┄┄┄┄┄┄┈┈┈", gray},
		{"You can check if there is a newer version at", gray},
		{"https://github.com/pathnirvana/tipitaka.lk/releases", gray},
	}
	width := 60
	boxColor := gray

	// Print top border
	boxColor.Println("┏" + strings.Repeat("━", width) + "┓")

	for i := 0; i < len(lines); i++ {
		textLen := utf8.RuneCountInString(lines[i].Text)
		padding := (width - textLen) / 2 // Calculate padding for centering
		boxColor.Print("┃")
		fmt.Print(strings.Repeat(" ", padding))
		lines[i].Color.Print(lines[i].Text)
		fmt.Print(strings.Repeat(" ", width-padding-textLen))
		boxColor.Println("┃")
	}

	// Print bottom border
	boxColor.Println("┗" + strings.Repeat("━", width) + "┛")
}
